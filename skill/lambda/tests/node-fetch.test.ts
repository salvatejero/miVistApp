import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { VpsClient, VpsError } from '../src/services/vps/client';
import { nodeFetch } from '../src/services/vps/node-fetch';

// Servidor que hace eco de la petición; /v1/house da 500 y /v1/weather no contesta nunca.
const server = createServer((req, res) => {
  if (req.url === '/v1/weather') return;
  let body = '';
  req.on('data', (chunk: Buffer) => (body += chunk.toString()));
  req.on('end', () => {
    res.statusCode = req.url === '/v1/house' ? 500 : 200;
    res.end(JSON.stringify({ method: req.method, url: req.url, auth: req.headers.authorization, body }));
  });
});
let base = '';

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.closeAllConnections();
  server.close();
});

describe('nodeFetch (Node.js 16 sin fetch)', () => {
  const client = () => new VpsClient(`${base}/`, 'clave', 200, nodeFetch);

  it('manda método, cabeceras y cuerpo y lee el JSON', async () => {
    const home = (await client().getHome()) as unknown as Record<string, string>;
    expect(home).toMatchObject({ method: 'GET', url: '/v1/home', auth: 'Bearer clave' });
    await expect(client().toggleDevice('luz')).resolves.toBeUndefined();
    const echo = await (await nodeFetch(`${base}/x`, { method: 'POST', body: '{"id":"luz"}' })).json();
    expect(echo).toMatchObject({ method: 'POST', body: '{"id":"luz"}' });
  });

  it('marca como error un HTTP 500 y corta al pasar el tiempo', async () => {
    await expect(client().getHouse()).rejects.toThrow(VpsError);
    await expect(client().getWeather()).rejects.toThrow();
  });
});
