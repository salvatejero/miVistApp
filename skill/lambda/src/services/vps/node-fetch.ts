import http from 'node:http';
import https from 'node:https';

/**
 * Lo mínimo de `fetch` que usa VpsClient, sobre http/https. Alexa-hosted corre en Node.js 16, que no trae `fetch`.
 * ponytail: solo method, headers, body y signal, y la respuesta solo ok, status y json(); si hace falta más, usar el fetch nativo.
 */
export const nodeFetch = ((url: string, init: RequestInit = {}) =>
  new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const request = client.request(
      url,
      { method: init.method ?? 'GET', headers: init.headers as http.OutgoingHttpHeaders, signal: init.signal ?? undefined },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('error', reject);
        response.on('end', () => {
          const status = response.statusCode ?? 0;
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({ ok: status >= 200 && status < 300, status, json: async () => JSON.parse(text) });
        });
      },
    );
    request.on('error', reject);
    request.end(init.body as string | undefined);
  })) as unknown as typeof fetch;
