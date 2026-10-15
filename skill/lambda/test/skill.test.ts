import type { interfaces, ResponseEnvelope } from 'ask-sdk-model';
import { describe, expect, it } from 'vitest';
import { HOME_TOKEN } from '../src/screens/home';
import { buildSkill } from '../src/skill';
import { contractValidator, requestEnvelope, schemaId } from './helpers';

type RenderDocument = interfaces.alexa.presentation.apl.RenderDocumentDirective;

const skill = buildSkill();
const invoke = (...args: Parameters<typeof requestEnvelope>): Promise<ResponseEnvelope> =>
  skill.invoke(requestEnvelope(...args));
const speech = (envelope: ResponseEnvelope): string =>
  (envelope.response.outputSpeech as { ssml?: string } | undefined)?.ssml ?? '';

describe('al abrir la skill', () => {
  it('pinta Inicio en un dispositivo con pantalla', async () => {
    const { response } = await invoke('LaunchRequest');
    const directive = response.directives?.[0] as RenderDocument;
    expect(directive.type).toBe('Alexa.Presentation.APL.RenderDocument');
    expect(directive.token).toBe(HOME_TOKEN);
    expect(response.shouldEndSession).toBeUndefined();
  });

  it('envía datos de Inicio que cumplen el contrato', async () => {
    const { response } = await invoke('LaunchRequest');
    const { datasources } = response.directives?.[0] as RenderDocument;
    const validate = contractValidator().getSchema(schemaId('home'))!;
    expect(validate(datasources?.home)).toBe(true);
  });

  it('incluye el tema compartido en el documento', async () => {
    const { response } = await invoke('LaunchRequest');
    const { document } = response.directives?.[0] as RenderDocument;
    const resources = JSON.stringify(document?.resources);
    expect(resources).toContain('colorBackground');
    expect(resources).toContain('viewport.width >= 1920');
  });

  it('explica que hace falta pantalla en un dispositivo sin ella', async () => {
    const { response } = await invoke('LaunchRequest', { apl: false });
    expect(response.directives).toBeUndefined();
    expect(speech({ response } as ResponseEnvelope)).toContain('pantalla');
    expect(response.shouldEndSession).toBe(true);
  });
});

describe('intents integrados', () => {
  it('vuelve a Inicio con NavigateHome', async () => {
    const { response } = await invoke('IntentRequest', { intent: 'AMAZON.NavigateHomeIntent' });
    expect((response.directives?.[0] as RenderDocument).token).toBe(HOME_TOKEN);
  });

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
    const envelope = await invoke('IntentRequest', { intent: 'AMAZON.FallbackIntent' });
    expect(speech(envelope)).toContain('No te he entendido');
  });
});

describe('errores', () => {
  it('responde con un mensaje si falla la fuente de datos', async () => {
    const failing = buildSkill({
      getHome: () => Promise.reject(new Error('caída')),
      getCalendar: () => Promise.reject(new Error('caída')),
      getWeather: () => Promise.reject(new Error('caída')),
      getHouse: () => Promise.reject(new Error('caída')),
    });
    const envelope = await failing.invoke(requestEnvelope('LaunchRequest'));
    expect(speech(envelope)).toContain('algo ha fallado');
  });
});
