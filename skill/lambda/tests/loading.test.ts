import type { interfaces, ResponseEnvelope } from 'ask-sdk-model';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCREEN_IDS, SCREENS } from '../src/apl/screens';
import { config } from '../src/config';
import type { DashboardData, HomeScreen } from '../src/contracts';
import { MockDashboardData } from '../src/services/mock';
import { MemoryCacheStore } from '../src/services/vps/cache-store';
import { CachedDashboardData } from '../src/services/vps/cached';
import { buildSkill } from '../src/skill';
import { contractErrors, requestEnvelope } from './helpers';

type RenderDocument = interfaces.alexa.presentation.apl.RenderDocumentDirective;

const SCHEMA = { inicio: 'home', calendario: 'calendar', tiempo: 'weather', casa: 'house' } as const;
const DATASOURCE = { inicio: 'home', calendario: 'calendar', tiempo: 'weather', casa: 'house' } as const;

/** Datos de ejemplo que tardan `ms` en llegar, como un VPS lento. */
function slow(ms: number, alert?: 'soon'): DashboardData {
  const mock = new MockDashboardData({ houseState: {}, alert });
  const later = <T>(value: Promise<T>) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));
  return {
    getHome: () => later(mock.getHome()),
    getCalendar: (o) => later(mock.getCalendar(o)),
    getWeather: () => later(mock.getWeather()),
    getHouse: () => later(mock.getHouse()),
    toggleDevice: (id) => mock.toggleDevice(id),
    turnAllOff: () => mock.turnAllOff(),
  };
}

const directive = (envelope: ResponseEnvelope) => envelope.response.directives?.[0] as RenderDocument;
const original = config.preloadAfterMs;

beforeEach(() => {
  config.preloadAfterMs = 20;
});
afterEach(() => {
  config.preloadAfterMs = original;
});

describe('primera carga', () => {
  it('con datos rápidos pinta directamente con el refresco normal', async () => {
    const envelope = await buildSkill(() => slow(0)).invoke(requestEnvelope('LaunchRequest'));
    const { document, datasources } = directive(envelope);
    expect((datasources?.home as HomeScreen).weather.status).toBe('ok');
    expect(document?.onMount).toEqual([{ type: 'SendEvent', delay: config.refreshMinutes * 60_000, arguments: ['refresh', 'inicio'] }]);
  });

  it('sin nada guardado y con datos lentos pinta el esqueleto de cada módulo y pide los datos', async () => {
    const envelope = await buildSkill(() => slow(200)).invoke(requestEnvelope('LaunchRequest'));
    const { document, datasources } = directive(envelope);
    const home = datasources?.home as HomeScreen;
    expect(contractErrors('home', home)).toEqual([]);
    expect([home.weather, home.rainForecast, home.commute, home.agenda, home.house].map((s) => s.status)).toEqual(Array(5).fill('loading'));
    expect(home.header.dateLabel).toMatch(/^[A-ZÁÉÍÓÚ][a-záéíóú]+, \d{1,2} de [a-z]+$/);
    const [onMount] = document?.onMount as Array<{ type: string; commands: Array<Record<string, unknown>> }>;
    expect(onMount?.type).toBe('Parallel');
    expect(onMount?.commands[0]).toEqual({ type: 'SendEvent', arguments: ['refresh', 'inicio'] });
    expect(onMount?.commands[1]).toMatchObject({ type: 'AnimateItem', componentId: 'contenido' });
    expect(document?.settings).toEqual({ idleTimeout: config.idleTimeoutMs });
  });

  it.each(SCREEN_IDS)('el esqueleto de %s cumple el contrato', async (screen) => {
    const envelope = await buildSkill(() => slow(200)).invoke(requestEnvelope('Alexa.Presentation.APL.UserEvent', { event: ['navigate', screen] }));
    const content = directive(envelope).datasources?.[DATASOURCE[screen]];
    expect(contractErrors(SCHEMA[screen], content)).toEqual([]);
    expect(JSON.stringify(content)).toContain('"loading"');
  });

  it('con datos guardados los pinta enseguida con "Actualizando…" y sin latido', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const store = new MemoryCacheStore();
    // Una primera visita rápida deja Inicio guardado (con un aviso de salida activo).
    await new CachedDashboardData(slow(0, 'soon'), store, 'Europe/Madrid').getHome();
    const data = new CachedDashboardData(slow(200, 'soon'), store, 'Europe/Madrid');
    const envelope = await buildSkill(() => data).invoke(requestEnvelope('LaunchRequest'));
    const { document, datasources } = directive(envelope);
    const home = datasources?.home as HomeScreen;
    expect(home.weather).toMatchObject({ status: 'ok', notice: 'Actualizando…' });
    expect(home.departureAlert).toBeNull();
    expect(contractErrors('home', home)).toEqual([]);
    expect(document?.onMount).toEqual([{ type: 'SendEvent', arguments: ['refresh', 'inicio'] }]);
  });

  it('el refresco que pide la pantalla provisional espera a los datos', async () => {
    const envelope = await buildSkill(() => slow(60)).invoke(requestEnvelope('Alexa.Presentation.APL.UserEvent', { event: ['refresh', 'tiempo'] }));
    expect(directive(envelope).datasources?.weather).toMatchObject({ status: 'ok' });
  });

  it('cambiar de mes también es progresivo', async () => {
    const envelope = await buildSkill(() => slow(200)).invoke(
      requestEnvelope('Alexa.Presentation.APL.UserEvent', { event: ['calendar.month', 1], attributes: { calendarOffset: 0 } }),
    );
    expect(directive(envelope).datasources?.calendar).toEqual({ status: 'loading' });
    expect(envelope.sessionAttributes?.calendarOffset).toBe(1);
  });

  it.each(SCREEN_IDS)('%s tiene el contenedor que late', (screen) => {
    expect(JSON.stringify(SCREENS[screen].document)).toContain('"id":"contenido"');
  });
});
