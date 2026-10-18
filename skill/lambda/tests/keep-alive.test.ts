import type { interfaces, ResponseEnvelope } from 'ask-sdk-model';
import { StaticAplTemplateValidator } from 'apl-suggester';
import { describe, expect, it, vi } from 'vitest';
import { withKeepAlive, withShared } from '../src/apl/render';
import { SCREEN_IDS, SCREENS } from '../src/apl/screens';
import { config } from '../src/config';
import type { CalendarScreen } from '../src/contracts';
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
    expect(document?.onMount).toEqual([{ type: 'SendEvent', delay: config.refreshMinutes * 60_000, arguments: ['refresh', screen] }]);
  });

  it('con un aviso de salida, Inicio se refresca cada minuto', async () => {
    vi.stubEnv('VISTAPP_MOCK_ALERT', 'soon');
    const { document } = directive(await tap(['refresh', 'inicio']));
    vi.unstubAllEnvs();
    expect(document?.onMount).toEqual([{ type: 'SendEvent', delay: 60_000, arguments: ['refresh', 'inicio'] }]);
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
