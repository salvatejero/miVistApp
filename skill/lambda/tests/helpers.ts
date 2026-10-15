import type { RequestEnvelope, ResponseEnvelope } from 'ask-sdk-model';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const contractsDir = join(import.meta.dirname, '../../../contracts');
export const aplDir = join(import.meta.dirname, '../../apl');

export function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export const fixture = (name: string): unknown => readJson(join(contractsDir, 'fixtures', `${name}.json`));

/** Validador con todos los esquemas de contracts/schemas cargados. */
export function contractValidator(): Ajv2020 {
  // strictRequired avisa de `required` dentro de if/then, que es JSON Schema válido.
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats.default(ajv);
  const dir = join(contractsDir, 'schemas');
  for (const file of readdirSync(dir)) {
    ajv.addSchema(readJson(join(dir, file)) as object);
  }
  return ajv;
}

export const schemaId = (name: string): string => `https://mivistapp.local/contracts/${name}.schema.json`;

const ajv = contractValidator();

/** Errores de validación de `value` contra el esquema `name` (lista vacía si es válido). */
export function contractErrors(name: string, value: unknown): unknown[] {
  const validate = ajv.getSchema(schemaId(name));
  if (!validate) throw new Error(`Esquema desconocido: ${name}`);
  return validate(value) ? [] : (validate.errors ?? []);
}

interface EnvelopeOptions {
  apl?: boolean;
  intent?: string;
  /** Valor resuelto de un slot: { nombre: id } (o null para un valor no reconocido). */
  slots?: Record<string, string | null>;
  /** Argumentos de un SendEvent (petición Alexa.Presentation.APL.UserEvent). */
  event?: unknown[];
  attributes?: Record<string, unknown>;
}

/** Sobre de petición mínimo, con datos inventados. */
export function requestEnvelope(type: string, options: EnvelopeOptions = {}): RequestEnvelope {
  const { apl = true, intent, slots = {}, event, attributes } = options;
  const supportedInterfaces = apl ? { 'Alexa.Presentation.APL': { runtime: { maxVersion: '2023.3' } } } : {};
  const base = { type, requestId: 'req-1', timestamp: '2026-10-15T06:30:00Z', locale: 'es-ES' };
  const slotEntries = Object.entries(slots).map(([name, id]) => [
    name,
    {
      name,
      value: id ?? 'algo',
      confirmationStatus: 'NONE',
      resolutions: {
        resolutionsPerAuthority: [
          id
            ? { authority: 'amzn1.er-authority', status: { code: 'ER_SUCCESS_MATCH' }, values: [{ value: { name: id, id } }] }
            : { authority: 'amzn1.er-authority', status: { code: 'ER_SUCCESS_NO_MATCH' } },
        ],
      },
    },
  ]);
  const request =
    type === 'IntentRequest'
      ? { ...base, intent: { name: intent, confirmationStatus: 'NONE', slots: Object.fromEntries(slotEntries) } }
      : type === 'Alexa.Presentation.APL.UserEvent'
        ? { ...base, token: 'vistapp', arguments: event ?? [], source: { type: 'TouchWrapper', handler: 'Press' } }
        : base;
  return {
    version: '1.0',
    session: {
      new: !attributes,
      sessionId: 'session-1',
      application: { applicationId: 'amzn1.ask.skill.test' },
      user: { userId: 'amzn1.ask.account.test' },
      attributes: attributes ?? {},
    },
    context: {
      System: {
        application: { applicationId: 'amzn1.ask.skill.test' },
        user: { userId: 'amzn1.ask.account.test' },
        device: { deviceId: 'device-1', supportedInterfaces },
        apiEndpoint: 'https://api.eu.amazonalexa.com',
      },
    },
    request,
  } as RequestEnvelope;
}

export const speech = (envelope: ResponseEnvelope): string =>
  (envelope.response.outputSpeech as { ssml?: string } | undefined)?.ssml ?? '';
