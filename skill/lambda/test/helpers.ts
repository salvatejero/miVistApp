import type { RequestEnvelope } from 'ask-sdk-model';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const contractsDir = join(import.meta.dirname, '../../../contracts');

export function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Validador con todos los esquemas de contracts/schemas cargados. */
export function contractValidator(): Ajv2020 {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats.default(ajv);
  const dir = join(contractsDir, 'schemas');
  for (const file of readdirSync(dir)) {
    ajv.addSchema(readJson(join(dir, file)) as object);
  }
  return ajv;
}

export const schemaId = (name: string): string => `https://mivistapp.local/contracts/${name}.schema.json`;

interface EnvelopeOptions {
  apl?: boolean;
  intent?: string;
}

/** Sobre de petición mínimo, con datos inventados. */
export function requestEnvelope(type: string, { apl = true, intent }: EnvelopeOptions = {}): RequestEnvelope {
  const supportedInterfaces = apl ? { 'Alexa.Presentation.APL': { runtime: { maxVersion: '2023.3' } } } : {};
  const request =
    type === 'IntentRequest'
      ? { type, requestId: 'req-1', timestamp: '2026-10-15T06:30:00Z', locale: 'es-ES', intent: { name: intent, confirmationStatus: 'NONE' } }
      : { type, requestId: 'req-1', timestamp: '2026-10-15T06:30:00Z', locale: 'es-ES' };
  return {
    version: '1.0',
    session: {
      new: true,
      sessionId: 'session-1',
      application: { applicationId: 'amzn1.ask.skill.test' },
      user: { userId: 'amzn1.ask.account.test' },
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
