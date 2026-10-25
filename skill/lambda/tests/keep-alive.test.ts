import type { interfaces, ResponseEnvelope } from 'ask-sdk-model';
import { StaticAplTemplateValidator } from 'apl-suggester';
import { describe, expect, it, vi } from 'vitest';
import { withKeepAlive, withShared } from '../src/apl/render';
import { SCREEN_IDS, SCREENS } from '../src/apl/screens';
import { config } from '../src/config';
import type { CalendarScreen } from '../src/contracts';
import { MockDashboardData } from '../src/services/mock';
import { buildSkill } from '../src/skill';
import { requestEnvelope } from './helpers';

type RenderDocument = interfaces.alexa.presentation.apl.RenderDocumentDirective;

const skill = buildSkill();
const tap = (event: unknown[], attributes?: Record<string, unknown>) =>
  skill.invoke(requestEnvelope('Alexa.Presentation.APL.UserEvent', { event, attributes }));
const directive = (envelope: ResponseEnvelope) => envelope.response.directives?.[0] as RenderDocument;

describe('pantalla siempre visible', () => {
  it.each(SCREEN_IDS)('%s pide una inactividad larga y programa su propio refresco', async (screen) => {
    const { document } = directive(await tap(['navigate', screen]));
    expect(document?.settings).toEqual({ idleTimeout: config.idleTimeoutMs });
    // Inicio de ejemplo tiene hoy un evento con salida calculada: cada minuto.
    const minutes = screen === 'inicio' ? config.alertRefreshMinutes : config.refreshMinutes;
    expect(document?.handleTick).toEqual([{ minimumDelay: minutes * 60_000, commands: [{ type: 'SendEvent', arguments: ['refresh', screen] }] }]);
    expect(document?.onMount).toBeUndefined();
  });

  it('con un aviso de salida, Inicio se refresca cada minuto', async () => {
    vi.stubEnv('VISTAPP_MOCK_ALERT', 'soon');
    const { document } = directive(await tap(['refresh', 'inicio']));
    vi.unstubAllEnvs();
    expect(document?.handleTick).toEqual([{ minimumDelay: 60_000, commands: [{ type: 'SendEvent', arguments: ['refresh', 'inicio'] }] }]);
  });

  it('también cada minuto si hoy hay un evento con salida calculada (el aviso aparece a su hora)', async () => {
    const data = new MockDashboardData({ houseState: {} });
    const home = await data.getHome();
    expect(home.agenda.status === 'ok' && home.agenda.today.items.some((i) => i.departure)).toBe(true);
    const { document } = directive(await buildSkill(() => data).invoke(requestEnvelope('LaunchRequest')));
    expect((document?.handleTick as Array<{ minimumDelay: number }>)[0]?.minimumDelay).toBe(60_000);
  });

  it('un refresco que falla no habla (la pantalla sigue y el siguiente tick reintenta)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fail = () => Promise.reject(new Error('caída'));
    const failing = buildSkill(() => ({ getHome: fail, getCalendar: fail, getWeather: fail, getHouse: fail, toggleDevice: fail, turnAllOff: fail }));
    const envelope = await failing.invoke(requestEnvelope('Alexa.Presentation.APL.UserEvent', { event: ['refresh', 'inicio'] }));
    expect(envelope.response.outputSpeech).toBeUndefined();
  });

  it.each(['Alexa.Presentation.APL.RuntimeError', 'System.ExceptionEncountered'])('%s se registra sin hablar', async (type) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const envelope = await skill.invoke(requestEnvelope(type));
    expect(envelope.response.outputSpeech).toBeUndefined();
  });

  it('el refresco vuelve a pintar la misma pantalla sin hablar', async () => {
    const envelope = await tap(['refresh', 'tiempo']);
    expect(directive(envelope).token).toBe('vistapp-tiempo');
    expect(envelope.response.outputSpeech).toBeUndefined();
    expect(envelope.response.shouldEndSession).toBeUndefined();
  });

  it('conserva el mes que se estaba viendo en el calendario', async () => {
    const envelope = await tap(['refresh', 'calendario'], { calendarOffset: 1 });
    const calendar = directive(envelope).datasources?.calendar as Extract<CalendarScreen, { status: 'ok' }>;
    expect(calendar.monthLabel).toBe('Noviembre 2026');
    expect(envelope.sessionAttributes?.calendarOffset).toBe(1);
  });

  it('a los 15 min sin uso, el refresco cierra la skill sin hablar', async () => {
    const envelope = await tap(['refresh', 'inicio'], { lastUseAt: Date.now() - config.idleTimeoutMs });
    expect(envelope.response.shouldEndSession).toBe(true);
    expect(envelope.response.outputSpeech).toBeUndefined();
    expect(envelope.response.directives).toBeUndefined();
  });

  it('el refresco no cuenta como uso; tocar la pantalla sí', async () => {
    const lastUseAt = Date.now() - 60_000;
    const refreshed = await tap(['refresh', 'inicio'], { lastUseAt });
    expect(directive(refreshed).token).toBe('vistapp-inicio');
    expect(refreshed.sessionAttributes?.lastUseAt).toBe(lastUseAt);
    const touched = await tap(['navigate', 'tiempo'], { lastUseAt });
    expect(touched.sessionAttributes?.lastUseAt).toBeGreaterThan(lastUseAt);
  });

  it('un refresco de pantalla desconocida vuelve a Inicio', async () => {
    expect(directive(await tap(['refresh', 'nada'])).token).toBe('vistapp-inicio');
  });

  it('el documento con refresco sigue pasando el validador de APL', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const document = withShared(withKeepAlive(SCREENS.inicio.document, { screen: 'inicio', refreshMs: 300_000, idleTimeoutMs: 1000 }));
    const results = await new StaticAplTemplateValidator().validate(document);
    const unexpected = results.filter((r) => !/must be an absolute value when the parent (width|height) is set to auto/.test(r.errorMessage));
    expect(unexpected).toEqual([]);
  });

  it('espera al VPS hasta 5 s y refresca cada 5 min', () => {
    expect(config.vpsTimeoutMs).toBe(5000);
    expect(config.refreshMinutes).toBe(5);
  });
});
