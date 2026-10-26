import { nodeFetch } from './node-fetch';
import type { CalendarScreen, DashboardData, HomeScreen, HouseScreen, WeatherScreen } from '../../contracts';

export class VpsError extends Error {
  override name = 'VpsError';
}

/** Habla con el servicio de datos del VPS (vps/src/server.ts). Lanza si no responde a tiempo o con error. */
export class VpsClient implements DashboardData {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly apiKey: string,
    private readonly timeoutMs: number,
    private readonly fetchFn: typeof fetch = globalThis.fetch ?? nodeFetch,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await this.fetchFn(`${this.baseUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
    });
    if (!response.ok) throw new VpsError(`HTTP ${response.status}`);
    return response.json();
  }

  getHome(): Promise<HomeScreen> {
    return this.request('/v1/home') as Promise<HomeScreen>;
  }

  getCalendar(monthOffset: number, day?: number): Promise<CalendarScreen> {
    return this.request(`/v1/calendar?offset=${monthOffset}${day === undefined ? '' : `&day=${day}`}`) as Promise<CalendarScreen>;
  }

  getWeather(): Promise<WeatherScreen> {
    return this.request('/v1/weather') as Promise<WeatherScreen>;
  }

  getHouse(): Promise<HouseScreen> {
    return this.request('/v1/house') as Promise<HouseScreen>;
  }

  async toggleDevice(id: string): Promise<void> {
    await this.request('/v1/house/toggle', { method: 'POST', body: JSON.stringify({ id }) });
  }

  async turnAllOff(): Promise<void> {
    await this.request('/v1/house/all-off', { method: 'POST' });
  }
}
