import type { interfaces, ResponseEnvelope } from 'ask-sdk-model';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screenToken } from '../src/apl/screens';
import type { CalendarScreen, HomeScreen, HouseScreen } from '../src/contracts';
import { buildSkill } from '../src/skill';
import { contractErrors, requestEnvelope, speech } from './helpers';

type RenderDocument = interfaces.alexa.presentation.apl.RenderDocumentDirective;

const skill = buildSkill();
const invoke = (...args: Parameters<typeof requestEnvelope>): Promise<ResponseEnvelope> => skill.invoke(requestEnvelope(...args));
const tap = (event: unknown[], attributes?: Record<string, unknown>) =>
  invoke('Alexa.Presentation.APL.UserEvent', { event, attributes });
const directive = (envelope: ResponseEnvelope): RenderDocument => envelope.response.directives?.[0] as RenderDocument;
const datasource = <T>(envelope: ResponseEnvelope, name: string): T => directive(envelope).datasources?.[name] as T;

afterEach(() => vi.unstubAllEnvs());

describe('al abrir la skill', () => {
  it('pinta Inicio con datos que cumplen el contrato y deja la sesión abierta', async () => {
    const envelope = await invoke('LaunchRequest');
    expect(directive(envelope).token).toBe(screenToken('inicio'));
    expect(contractErrors('home', datasource(envelope, 'home'))).toEqual([]);
    expect(envelope.response.shouldEndSession).toBeUndefined();
  });

  it('incluye el paquete compartido en el documento', async () => {
    const { document } = directive(await invoke('LaunchRequest'));
    expect(JSON.stringify(document?.resources)).toContain('viewport.width >= 1920');
    expect(Object.keys(document?.layouts as object)).toContain('MenuLateral');
    expect(Object.keys(document?.graphics as object)).toContain('iconCasa');
  });

  it('explica que hace falta pantalla en un dispositivo sin ella', async () => {
    const envelope = await invoke('LaunchRequest', { apl: false });
    expect(envelope.response.directives).toBeUndefined();
    expect(speech(envelope)).toContain('pantalla');
    expect(envelope.response.shouldEndSession).toBe(true);
  });

  it('muestra el aviso de salida cuando el mock lo tiene activado', async () => {
    vi.stubEnv('VISTAPP_MOCK_ALERT', 'soon');
    const home = datasource<HomeScreen>(await invoke('LaunchRequest'), 'home');
    expect(home.departureAlert?.state).toBe('soon');
    expect(contractErrors('home', home)).toEqual([]);
  });
});

describe('navegación', () => {
  it.each([
    ['inicio', 'home'],
    ['calendario', 'calendar'],
    ['tiempo', 'weather'],
    ['casa', 'house'],
  ])('el menú lleva a %s', async (screen, schema) => {
    const envelope = await tap(['navigate', screen]);
    expect(directive(envelope).token).toBe(`vistapp-${screen}`);
    expect(contractErrors(schema, datasource(envelope, schema))).toEqual([]);
    expect(envelope.response.outputSpeech).toBeUndefined();
    expect(envelope.response.shouldEndSession).toBeUndefined();
  });

  it('cambia de pantalla por voz', async () => {
    const envelope = await invoke('IntentRequest', { intent: 'ShowScreenIntent', slots: { pantalla: 'tiempo' } });
    expect(directive(envelope).token).toBe('vistapp-tiempo');
  });

  it('pregunta qué pantalla si no reconoce la pedida', async () => {
    const envelope = await invoke('IntentRequest', { intent: 'ShowScreenIntent', slots: { pantalla: null } });
    expect(envelope.response.directives).toBeUndefined();
    expect(speech(envelope)).toContain('calendario');
    expect(envelope.response.reprompt).toBeDefined();
  });

  it('vuelve a Inicio con NavigateHome', async () => {
    const envelope = await invoke('IntentRequest', { intent: 'AMAZON.NavigateHomeIntent' });
    expect(directive(envelope).token).toBe('vistapp-inicio');
  });

  it('ignora eventos de pantalla desconocidos', async () => {
    const envelope = await tap(['otra.cosa']);
    expect(envelope.response.directives).toBeUndefined();
    expect(envelope.response.outputSpeech).toBeUndefined();
  });
});

describe('calendario', () => {
  const month = (envelope: ResponseEnvelope) => (datasource<CalendarScreen>(envelope, 'calendar') as { monthLabel: string }).monthLabel;

  it('avanza, retrocede y vuelve a hoy', async () => {
    let envelope = await tap(['navigate', 'calendario']);
    expect(month(envelope)).toBe('Octubre 2026');
    envelope = await tap(['calendar.month', 1], envelope.sessionAttributes);
    expect(month(envelope)).toBe('Noviembre 2026');
    envelope = await tap(['calendar.month', -1], envelope.sessionAttributes);
    envelope = await tap(['calendar.month', -1], envelope.sessionAttributes);
    expect(month(envelope)).toBe('Septiembre 2026');
    expect(contractErrors('calendar', datasource(envelope, 'calendar'))).toEqual([]);
    envelope = await tap(['calendar.month', 0], envelope.sessionAttributes);
    expect(month(envelope)).toBe('Octubre 2026');
  });

  it('al pulsar un día muestra ese día, y al cambiar de mes vuelve al día por defecto', async () => {
    const selected = (envelope: ResponseEnvelope) => datasource<CalendarScreen>(envelope, 'calendar') as Extract<CalendarScreen, { status: 'ok' }>;
    let envelope = await tap(['navigate', 'calendario']);
    // El Echo Show puede mandar el número como texto.
    envelope = await tap(['calendar.day', '20'], envelope.sessionAttributes);
    expect(selected(envelope).selectedDay.title).toBe('20 oct');
    expect(selected(envelope).cells.filter((c) => c.isSelected).map((c) => c.day)).toEqual([20]);
    expect(contractErrors('calendar', selected(envelope))).toEqual([]);
    envelope = await tap(['calendar.month', '1'], envelope.sessionAttributes);
    expect(selected(envelope).selectedDay.title).toBe('1 nov');
  });

  it('vuelve al mes actual al entrar desde el menú', async () => {
    const envelope = await tap(['navigate', 'calendario'], { calendarOffset: 5 });
    expect(month(envelope)).toBe('Octubre 2026');
  });
});

describe('casa', () => {
  const devices = (envelope: ResponseEnvelope) =>
    (datasource<HouseScreen>(envelope, 'house') as Extract<HouseScreen, { status: 'ok' }>).devices;

  it('enciende un dispositivo y lo recuerda en la sesión', async () => {
    let envelope = await tap(['house.toggle', 'cocina', 'casa']);
    expect(devices(envelope).find((d) => d.id === 'cocina')).toMatchObject({ on: true, stateLabel: 'Encendido' });
    expect(datasource<{ summary: string }>(envelope, 'house').summary).toBe('3 de 8 encendidos');
    envelope = await tap(['navigate', 'casa'], envelope.sessionAttributes);
    expect(devices(envelope).find((d) => d.id === 'cocina')?.on).toBe(true);
  });

  it('vuelve a pintar Inicio si se pulsa allí', async () => {
    const envelope = await tap(['house.toggle', 'persiana-salon', 'inicio']);
    expect(directive(envelope).token).toBe('vistapp-inicio');
    const home = datasource<HomeScreen>(envelope, 'home');
    expect(home.house.status === 'ok' && home.house.devices.find((d) => d.id === 'persiana-salon')).toMatchObject({
      on: true,
      stateLabel: 'Abierta',
    });
  });

  it('apaga todo', async () => {
    const envelope = await tap(['house.allOff', 'casa']);
    expect(devices(envelope).every((d) => !d.on)).toBe(true);
    expect(datasource<{ summary: string }>(envelope, 'house').summary).toBe('0 de 8 encendidos');
  });
});

describe('intents integrados', () => {
  it('da ayuda y deja el micrófono abierto', async () => {
    const envelope = await invoke('IntentRequest', { intent: 'AMAZON.HelpIntent' });
    expect(speech(envelope)).toContain('menú');
    expect(envelope.response.reprompt).toBeDefined();
  });

  it.each(['AMAZON.StopIntent', 'AMAZON.CancelIntent'])('cierra con %s', async (intent) => {
    const { response } = await invoke('IntentRequest', { intent });
    expect(response.shouldEndSession).toBe(true);
  });

  it('responde al fallback', async () => {
    expect(speech(await invoke('IntentRequest', { intent: 'AMAZON.FallbackIntent' }))).toContain('No te he entendido');
  });
});

describe('errores', () => {
  it('responde con un mensaje si la fuente de datos lanza', async () => {
    const fail = () => Promise.reject(new Error('caída'));
    const failing = buildSkill(() => ({
      getHome: fail,
      getCalendar: fail,
      getWeather: fail,
      getHouse: fail,
      toggleDevice: fail,
      turnAllOff: fail,
    }));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const envelope = await failing.invoke(requestEnvelope('LaunchRequest'));
    expect(speech(envelope)).toContain('algo ha fallado');
  });
});
