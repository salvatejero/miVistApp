import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MockDashboardData } from '../../skill/lambda/src/services/mock';
import { createApi } from '../src/server';

const KEY = 'k'.repeat(40);
const server = createApi(new MockDashboardData({ houseState: {} }), KEY);
let base = '';

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const call = (path: string, init: RequestInit = {}, key: string | null = KEY) =>
  fetch(`${base}${path}`, { ...init, headers: { ...(key ? { authorization: `Bearer ${key}` } : {}), 'content-type': 'application/json' } });

describe('API del VPS', () => {
  it('responde a /healthz sin clave', async () => {
    expect((await call('/healthz', {}, null)).status).toBe(200);
  });

  it('rechaza peticiones sin clave o con otra clave', async () => {
    expect((await call('/v1/home', {}, null)).status).toBe(401);
    expect((await call('/v1/home', {}, 'x'.repeat(40))).status).toBe(401);
  });

  it('sirve cada pantalla', async () => {
    for (const path of ['/v1/home', '/v1/calendar?offset=-2', '/v1/weather', '/v1/house']) {
      const response = await call(path);
      expect(response.status, path).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
  });

  it('valida el desplazamiento del calendario', async () => {
    expect((await call('/v1/calendar?offset=abc')).status).toBe(400);
  });

  it('enciende y apaga dispositivos', async () => {
    expect((await call('/v1/house/toggle', { method: 'POST', body: JSON.stringify({ id: 'cocina' }) })).status).toBe(200);
    const house = (await (await call('/v1/house')).json()) as { devices: Array<{ id: string; on: boolean }> };
    expect(house.devices.find((d) => d.id === 'cocina')?.on).toBe(true);
    expect((await call('/v1/house/all-off', { method: 'POST' })).status).toBe(200);
    expect((await call('/v1/house/toggle', { method: 'POST', body: '{roto' })).status).toBe(400);
  });

  it('no da detalles de errores internos', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failing = createApi({ ...new MockDashboardData(), getHome: () => Promise.reject(new Error('secreto')) } as never, KEY);
    await new Promise<void>((resolve) => failing.listen(0, '127.0.0.1', resolve));
    const port = (failing.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/v1/home`, { headers: { authorization: `Bearer ${KEY}` } });
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('secreto');
    await new Promise<void>((resolve) => failing.close(() => resolve()));
  });

  it('responde 404 a rutas desconocidas', async () => {
    expect((await call('/v1/nada')).status).toBe(404);
  });
});
