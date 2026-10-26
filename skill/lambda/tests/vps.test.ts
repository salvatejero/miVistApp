import type { interfaces } from 'ask-sdk-model';
import { describe, expect, it, vi } from 'vitest';
import type { DashboardData, HomeScreen } from '../src/contracts';
import { MockDashboardData } from '../src/services/mock';
import type { DocumentClient } from '../src/services/vps/cache-store';
import { DynamoCacheStore, MemoryCacheStore } from '../src/services/vps/cache-store';
import { CachedDashboardData } from '../src/services/vps/cached';
import { VpsClient } from '../src/services/vps/client';
import { buildSkill } from '../src/skill';
import { contractErrors, requestEnvelope, speech } from './helpers';

const TZ = 'Europe/Madrid';
// 15/10/2026 08:30 en Madrid
const SAVED = Date.parse('2026-10-15T06:30:00Z');

/** VPS simulado: devuelve los datos de ejemplo (con aviso de salida) hasta que se "cae". */
function flakyVps() {
  const mock = new MockDashboardData({ houseState: {}, alert: 'soon' });
  const state = { down: false };
  const guard = <T>(fn: () => Promise<T>) => (state.down ? Promise.reject(new Error('timeout')) : fn());
  const remote: DashboardData = {
    getHome: () => guard(() => mock.getHome()),
    getCalendar: (o) => guard(() => mock.getCalendar(o)),
    getWeather: () => guard(() => mock.getWeather()),
    getHouse: () => guard(() => mock.getHouse()),
    toggleDevice: (id) => guard(() => mock.toggleDevice(id)),
    turnAllOff: () => guard(() => mock.turnAllOff()),
  };
  return { remote, state };
}

describe('cliente del VPS', () => {
  it('pide cada pantalla con la clave y respeta el tiempo máximo', async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push([String(url), init]);
      return new Response('{"status":"ok"}', { status: 200 });
    }) as typeof fetch;
    const client = new VpsClient('https://vps.example.com/', 'clave', 2000, fetchFn);
    await client.getCalendar(-1);
    await client.toggleDevice('cocina');
    expect(calls.map(([url]) => url)).toEqual(['https://vps.example.com/v1/calendar?offset=-1', 'https://vps.example.com/v1/house/toggle']);
    expect((calls[0]![1]!.headers as Record<string, string>).authorization).toBe('Bearer clave');
    expect(calls[0]![1]!.signal).toBeInstanceOf(AbortSignal);
    expect(calls[1]![1]).toMatchObject({ method: 'POST', body: '{"id":"cocina"}' });
  });

  it('falla con respuestas de error', async () => {
    const fetchFn = (async () => new Response('', { status: 401 })) as typeof fetch;
    await expect(new VpsClient('https://vps.example.com', 'mala', 2000, fetchFn).getHome()).rejects.toThrow('401');
  });
});

describe('caché de la skill', () => {
  it('guarda cada respuesta buena', async () => {
    const store = new MemoryCacheStore();
    const data = new CachedDashboardData(flakyVps().remote, store, TZ, () => SAVED);
    await data.getHome();
    await data.getCalendar(2);
    expect([...store.items.keys()]).toEqual(['home', 'calendar:2']);
  });

  it('si el VPS cae, pinta lo guardado con la hora y sin aviso de salida', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { remote, state } = flakyVps();
    let now = SAVED;
    const data = new CachedDashboardData(remote, new MemoryCacheStore(), TZ, () => now);
    expect((await data.getHome()).departureAlert?.state).toBe('soon');
    state.down = true;
    now = SAVED + 45 * 60_000;
    const home = await data.getHome();
    expect(contractErrors('home', home)).toEqual([]);
    expect(home.departureAlert).toBeNull();
    expect(home.weather).toMatchObject({ status: 'ok', notice: 'Sin conexión · actualizado a las 08:30' });
    expect(home.agenda).toMatchObject({ notice: 'Sin conexión · actualizado a las 08:30' });
    expect(home.agenda.status === 'ok' && home.agenda.today.items.some((i) => i.departure)).toBe(false);
  });

  it('indica el día si lo guardado es de otro día', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { remote, state } = flakyVps();
    let now = SAVED;
    const data = new CachedDashboardData(remote, new MemoryCacheStore(), TZ, () => now);
    await data.getWeather();
    state.down = true;
    now = SAVED + 26 * 3_600_000;
    expect(await data.getWeather()).toMatchObject({ notice: 'Sin conexión · actualizado el 15/10 a las 08:30' });
  });

  it('sin nada guardado, cada bloque dice que no hay conexión', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { remote, state } = flakyVps();
    state.down = true;
    const data = new CachedDashboardData(remote, new MemoryCacheStore(), TZ, () => SAVED);
    const home = await data.getHome();
    expect(contractErrors('home', home)).toEqual([]);
    expect(home.header.dateLabel).toBe('Jueves, 15 de octubre');
    expect(home.agenda).toEqual({ status: 'error', message: 'Sin conexión con el servidor' });
    for (const [schema, screen] of [
      ['calendar', await data.getCalendar(0)],
      ['weather', await data.getWeather()],
      ['house', await data.getHouse()],
    ] as const) {
      expect(contractErrors(schema, screen), schema).toEqual([]);
    }
  });

  it('lo guardado de otro día lleva la fecha de hoy y no enseña su "Hoy"', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { remote, state } = flakyVps();
    let now = SAVED;
    const data = new CachedDashboardData(remote, new MemoryCacheStore(), TZ, () => now);
    await data.getHome();
    state.down = true;
    now = SAVED + 24 * 3_600_000;
    const home = await data.getHome();
    expect(home.header.dateLabel).toBe('Viernes, 16 de octubre');
    expect(home.agenda).toEqual({ status: 'error', message: 'Sin conexión con el calendario' });
    expect(home.weather).toMatchObject({ notice: 'Sin conexión · actualizado el 15/10 a las 08:30' });
    expect(contractErrors('home', home)).toEqual([]);
  });

  it('si DynamoDB se cuelga, no espera más de un segundo', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const hanging = { get: () => new Promise<never>(() => undefined), set: () => new Promise<never>(() => undefined) };
    const data = new CachedDashboardData(flakyVps().remote, hanging, TZ, () => SAVED);
    const started = Date.now();
    expect((await data.getHome()).weather.status).toBe('ok');
    expect(Date.now() - started).toBeLessThan(1500);
  });

  it('si DynamoDB falla, sigue funcionando con el VPS', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const broken = { get: () => Promise.reject(new Error('dynamo')), set: () => Promise.reject(new Error('dynamo')) };
    const data = new CachedDashboardData(flakyVps().remote, broken, TZ, () => SAVED);
    expect((await data.getHome()).weather.status).toBe('ok');
  });
});

describe('DynamoDB', () => {
  it('guarda y lee por pantalla en la tabla de Alexa-hosted', async () => {
    const items = new Map<string, Record<string, unknown>>();
    const client: DocumentClient = {
      send: (command) => {
        const input = command.input as { Key?: { id: string }; Item?: { id: string } };
        if (input.Item) {
          items.set(input.Item.id, input.Item);
          return Promise.resolve({});
        }
        return Promise.resolve({ Item: items.get(input.Key!.id) });
      },
    };
    const store = new DynamoCacheStore('tabla', client);
    await store.set('home', { a: 1 }, SAVED);
    expect([...items.keys()]).toEqual(['vistapp-cache#home']);
    expect(await store.get('home')).toEqual({ savedAt: SAVED, value: { a: 1 } });
    expect(await store.get('weather')).toBeUndefined();
  });
});

describe('skill con el VPS caído', () => {
  it('abre Inicio con lo guardado', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { remote, state } = flakyVps();
    const data = new CachedDashboardData(remote, new MemoryCacheStore(), TZ);
    const skill = buildSkill(() => data);
    await skill.invoke(requestEnvelope('LaunchRequest'));
    state.down = true;
    const envelope = await skill.invoke(requestEnvelope('LaunchRequest'));
    const directive = envelope.response.directives?.[0] as interfaces.alexa.presentation.apl.RenderDocumentDirective;
    const home = directive.datasources?.home as HomeScreen;
    expect(home.weather.notice).toMatch(/^Sin conexión · actualizado a las \d\d:\d\d$/);
  });

  it('avisa en voz si no puede actuar sobre la casa y pinta sin volver a esperar al VPS', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { remote, state } = flakyVps();
    const store = new MemoryCacheStore();
    const data = new CachedDashboardData(remote, store, TZ);
    await data.getHouse();
    state.down = true;
    const getHouse = vi.spyOn(remote, 'getHouse');
    const skill = buildSkill(() => data);
    const envelope = await skill.invoke(requestEnvelope('Alexa.Presentation.APL.UserEvent', { event: ['house.toggle', 'cocina', 'casa'] }));
    expect(speech(envelope)).toContain('No he podido conectar con la casa');
    expect(getHouse).not.toHaveBeenCalled();
    const directive = envelope.response.directives?.[0] as interfaces.alexa.presentation.apl.RenderDocumentDirective;
    expect(directive.token).toBe('vistapp-casa');
    expect(directive.datasources?.house).toMatchObject({ status: 'ok', notice: 'Actualizando…' });
  });
});
