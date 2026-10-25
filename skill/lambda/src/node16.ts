import { webcrypto } from 'node:crypto';

// Alexa-hosted corre en Node.js 16, sin `crypto` global; el SDK de AWS (DynamoDB) lo lee al cargarse,
// así que este módulo se importa el primero en index.ts.
globalThis.crypto ??= webcrypto as typeof globalThis.crypto;
