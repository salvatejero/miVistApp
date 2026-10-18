import { describe, expect, it, vi } from 'vitest';
import { contractErrors } from '../../skill/lambda/tests/helpers';
import { startOfDay } from '../../lib/time';
import { VpsDashboard } from '../src/dashboard';
import type { CalendarSource } from '../src/services/calendar/caldav';
import type { CalendarEvent } from '../src/services/calendar/ical';
import { MockHouse } from '../src/services/home/mock-house';
import { TomTom } from '../src/services/traffic/tomtom';
import { OpenMeteo } from '../src/services/weather/open-meteo';
import { fakeFetch, openMeteoResponse, testConfig, TZ } from './helpers';

// Jueves 15/10/2026 a las 08:15 en Madrid.
const NOW = new Date('2026-10-15T06:15:00Z');

const timed = (id: string, title: string, startUtc: string, location?: string): CalendarEvent => ({
  id,
  title,
  allDay: false,
  start: new Date(startUtc),
  end: new Date(new Date(startUtc).getTime() + 3_600_000),
  ...(location ? { location } : {}),
});

const EVENTS: CalendarEvent[] = [
  // 09:00 en el centro de salud: con 20 min de trayecto y 10 de colchón, salir a las 08:30 → faltan 15 min.
  timed('salud', 'Revisión médica', '2026-10-15T07:00:00Z', 'Centro de salud, Calle Falsa 1'),
  timed('reunion', 'Reunión', '2026-10-15T08:00:00Z', 'https://teams.microsoft.com/l/x'),
  timed('cena', 'Cena', '2026-10-16T19:00:00Z', 'Restaurante'),
];

const calendarOf = (events: CalendarEvent[] | Error): CalendarSource & { calls: number } => {
  const source = {
    calls: 0,
    events: () => {
      source.calls++;
      return events instanceof Error ? Promise.reject(events) : Promise.resolve(events);
    },
  };
  return source;
};

const tomtomFetch = (status = 200) =>
  fakeFetch((url) => {
    if (url.includes('/geocode/')) return { status, body: { results: [{ position: { lat: 40.2, lon: -3.2 } }] } };
    return { status, body: { routes: [{ summary: { travelTimeInSeconds: 1200, trafficDelayInSeconds: 60 } }] } };
  });

function dashboard(options: { calendar?: CalendarSource; weatherStatus?: number; tomtomStatus?: number; now?: () => Date } = {}) {
  const now = options.now ?? (() => NOW);
  return new VpsDashboard(testConfig(), {
    weather: new OpenMeteo(fakeFetch(() => ({ status: options.weatherStatus ?? 200, body: openMeteoResponse() })), { lat: 40, lon: -3 }, TZ),
    tomtom: new TomTom(tomtomFetch(options.tomtomStatus), 'clave'),
    calendar: options.calendar ?? calendarOf(EVENTS),
    house: new MockHouse(),
    now,
  });
}

describe('pantallas desde el VPS', () => {
  it('Inicio cumple el contrato con todas las fuentes', async () => {
    const home = await dashboard().getHome();
    expect(contractErrors('home', home)).toEqual([]);
    expect(home.header.dateLabel).toBe('Jueves, 15 de octubre');
    expect(home.weather).toMatchObject({ status: 'ok', temperature: 19, rainAlertLabel: 'Aviso de lluvia · 10:00' });
    // Entrada a las 09:00, 20 min de trayecto y 10 de colchón.
    expect(home.commute).toMatchObject({ status: 'ok', durationMinutes: 20, leaveAt: '08:30', trafficLabel: 'Tráfico fluido' });
  });

  it('calcula el aviso de salida del próximo evento con ubicación física', async () => {
    const home = await dashboard().getHome();
    expect(home.departureAlert).toMatchObject({ eventId: 'salud', state: 'appear', placeLabel: 'Centro de salud', leaveAt: '08:30', minutesToLeave: 15 });
    const today = home.agenda.status === 'ok' ? home.agenda.today.items : [];
    expect(today.find((i) => i.id === 'salud')?.departure).toEqual({ placeLabel: 'Centro de salud', travelMinutes: 20, leaveAt: '08:30' });
    expect(today.find((i) => i.id === 'reunion')?.departure).toBeUndefined();
  });

  it('Calendario, Tiempo y Casa cumplen el contrato', async () => {
    const data = dashboard();
    for (const offset of [-1, 0, 1, 14]) expect(contractErrors('calendar', await data.getCalendar(offset)), `offset ${offset}`).toEqual([]);
    const weather = await data.getWeather();
    expect(contractErrors('weather', weather)).toEqual([]);
    expect(weather.status === 'ok' && weather.hourlyRain.status === 'ok' && weather.hourlyRain.bars).toHaveLength(12);
    expect(contractErrors('house', await data.getHouse())).toEqual([]);
  });

  it('cada bloque falla por separado con un mensaje', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const home = await dashboard({ calendar: calendarOf(new Error('401')), weatherStatus: 500, tomtomStatus: 500 }).getHome();
    expect(contractErrors('home', home)).toEqual([]);
    expect(home.weather.status).toBe('error');
    expect(home.commute.status).toBe('error');
    expect(home.agenda).toEqual({ status: 'error', message: 'Sin conexión con el calendario' });
    expect(home.house.status).toBe('ok');
    expect(home.departureAlert).toBeNull();
  });

  it('sirve el último dato con aviso si una fuente cae, y no avisa de salida con tráfico viejo', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let now = NOW;
    let fail = false;
    const flaky = (body: () => unknown) => fakeFetch(() => (fail ? { status: 500, body: {} } : { body: body() }));
    const data = new VpsDashboard(testConfig(), {
      weather: new OpenMeteo(flaky(openMeteoResponse), { lat: 40, lon: -3 }, TZ),
      tomtom: new TomTom(tomtomFetch(), 'clave'),
      calendar: calendarOf(EVENTS),
      house: new MockHouse(),
      now: () => now,
    });
    await data.getHome();
    fail = true;
    now = new Date(NOW.getTime() + 20 * 60_000);
    const home = await data.getHome();
    expect(home.weather).toMatchObject({ status: 'ok', notice: 'No actualizado · 08:15' });
    expect(contractErrors('home', home)).toEqual([]);
  });

  it('no pregunta al calendario en cada petición', async () => {
    const calendar = calendarOf(EVENTS);
    const data = dashboard({ calendar });
    await data.getHome();
    await data.getHome();
    expect(calendar.calls).toBe(1);
  });

  it('dice qué falta configurar', async () => {
    const data = new VpsDashboard(testConfig({ home: undefined, tomtomApiKey: undefined, icloud: undefined }), { house: new MockHouse(), now: () => NOW });
    const home = await data.getHome();
    expect(contractErrors('home', home)).toEqual([]);
    expect(home.weather).toEqual({ status: 'empty', message: 'Tiempo sin configurar' });
    expect(home.commute).toEqual({ status: 'empty', message: 'Tráfico sin configurar' });
    expect(await data.getCalendar(0)).toEqual({ status: 'empty', message: 'Calendario sin configurar' });
  });

  it('los días civiles salen en la zona del usuario', () => {
    expect(startOfDay({ year: 2026, month: 10, day: 15 }, TZ).toISOString()).toBe('2026-10-14T22:00:00.000Z');
  });
});
