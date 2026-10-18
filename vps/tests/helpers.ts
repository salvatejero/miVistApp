import type { Config } from '../src/config';
import type { Fetch } from '../src/http';

export const TZ = 'Europe/Madrid';

/** Configuración de pruebas con coordenadas inventadas. */
export const testConfig = (overrides: Partial<Config> = {}): Config => ({
  port: 0,
  host: '127.0.0.1',
  apiKey: 'k'.repeat(40),
  timeZone: TZ,
  cityLabel: 'Ciudad de ejemplo',
  home: { lat: 40.0, lon: -3.0 },
  work: { lat: 40.1, lon: -3.1 },
  workStart: '09:00',
  routeLabel: 'Casa → Trabajo',
  tomtomApiKey: 'tomtom-de-prueba',
  icloud: { username: 'ejemplo@example.com', appPassword: 'xxxx-xxxx-xxxx-xxxx', calendars: [] },
  departure: { bufferMinutes: 10, appearMinutes: 30, soonMinutes: 10 },
  refresh: { weather: 15, traffic: 5, calendar: 5 },
  ...overrides,
});

/** fetch simulado: responde según la URL y guarda las URLs pedidas. */
export function fakeFetch(handler: (url: string) => { status?: number; body: unknown }): Fetch & { urls: string[] } {
  const urls: string[] = [];
  const fn = (async (input: string | URL | Request) => {
    const url = String(input);
    urls.push(url);
    const { status = 200, body } = handler(url);
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as Fetch & { urls: string[] };
  fn.urls = urls;
  return fn;
}

/** Respuesta de Open-Meteo para el 15/10/2026 a las 08:xx, con lluvia desde las 10:00 durante 3 horas. */
export function openMeteoResponse() {
  const hours = Array.from({ length: 48 }, (_, i) => {
    const day = 15 + Math.floor(i / 24);
    return `2026-10-${day}T${String(i % 24).padStart(2, '0')}:00`;
  });
  const probability = hours.map((_, i) => (i >= 10 && i <= 12 ? 80 : 10));
  return {
    current: { time: '2026-10-15T08:15', temperature_2m: 18.6, weather_code: 3 },
    hourly: { time: hours, precipitation_probability: probability },
    daily: {
      time: ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21'],
      weather_code: [3, 61, 63, 2, 0, 0, 95],
      temperature_2m_max: [21.4, 18, 17, 20, 23, 24, 22],
      temperature_2m_min: [12.6, 12, 11, 12, 13, 14, 14],
      precipitation_probability_max: [80, 90, 60, 20, 5, 5, 40],
    },
  };
}
