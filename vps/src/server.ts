import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import type { DashboardData } from '../../contracts/types';

const MAX_BODY = 4096;

function authorized(request: IncomingMessage, apiKey: string): boolean {
  const header = request.headers.authorization ?? '';
  const expected = Buffer.from(`Bearer ${apiKey}`);
  const received = Buffer.from(header);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new RangeError('Cuerpo demasiado grande');
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return {};
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
}

/**
 * API del servicio de datos. Todas las rutas salvo /healthz exigen `Authorization: Bearer <clave>`.
 *   GET  /v1/home · /v1/calendar?offset=N · /v1/weather · /v1/house
 *   POST /v1/house/toggle {"id": "..."} · /v1/house/all-off
 */
export function createApi(dashboard: DashboardData, apiKey: string) {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const route = `${request.method} ${url.pathname}`;
    try {
      if (route === 'GET /healthz') return send(response, 200, { ok: true });
      if (!authorized(request, apiKey)) return send(response, 401, { error: 'unauthorized' });
      switch (route) {
        case 'GET /v1/home':
          return send(response, 200, await dashboard.getHome());
        case 'GET /v1/calendar': {
          const offset = Number(url.searchParams.get('offset') ?? 0);
          if (!Number.isInteger(offset) || Math.abs(offset) > 120) return send(response, 400, { error: 'offset' });
          return send(response, 200, await dashboard.getCalendar(offset));
        }
        case 'GET /v1/weather':
          return send(response, 200, await dashboard.getWeather());
        case 'GET /v1/house':
          return send(response, 200, await dashboard.getHouse());
        case 'POST /v1/house/toggle': {
          const { id } = await readJson(request);
          if (typeof id !== 'string' || id.length > 100) return send(response, 400, { error: 'id' });
          await dashboard.toggleDevice(id);
          return send(response, 200, { ok: true });
        }
        case 'POST /v1/house/all-off':
          await dashboard.turnAllOff();
          return send(response, 200, { ok: true });
        default:
          return send(response, 404, { error: 'not_found' });
      }
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof RangeError) return send(response, 400, { error: 'body' });
      console.error('Error en', route, error instanceof Error ? error.name : 'Error');
      return send(response, 500, { error: 'internal' });
    }
  });
}
