import { describe, expect, it } from 'vitest';
import { describeWeatherCode, hoursFrom, OpenMeteo, rainOutlook, toForecast, weekFrom } from '../src/services/weather/open-meteo';
import { fakeFetch, openMeteoResponse, TZ } from './helpers';

describe('Open-Meteo', () => {
  const now = { year: 2026, month: 10, day: 15, hour: 8, minute: 15 };

  it('traduce la respuesta a la semana y la lluvia por horas', () => {
    const forecast = toForecast(openMeteoResponse());
    expect(forecast).toMatchObject({ temperature: 19, conditionLabel: 'Nublado', icon: 'cloud' });
    const days = weekFrom(forecast, now)!;
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ name: 'Hoy', dateLabel: 'Jue 15', isToday: true, icon: 'cloud', maxTemp: 21, minTemp: 13, rainProbability: 80 });
    expect(days[1]).toMatchObject({ name: 'Vie', dateLabel: '16', icon: 'rain' });
    expect(days[6]?.icon).toBe('storm');
    expect(hoursFrom(forecast, now)[0]).toEqual({ time: '2026-10-15T08', hour: 8, probability: 0.1 });
  });

  it('decide "Hoy" y "Ahora" al componer, no al pedir', () => {
    const forecast = toForecast(openMeteoResponse());
    // Pasada la medianoche, la misma previsión empieza en el viernes…
    expect(weekFrom({ ...forecast, daily: [...forecast.daily, { ...forecast.daily[6]!, date: '2026-10-22' }] }, { year: 2026, month: 10, day: 16 })?.[0])
      .toMatchObject({ name: 'Hoy', dateLabel: 'Vie 16' });
    // …y si ya no cubre 7 días, no se pinta una semana incompleta.
    expect(weekFrom(forecast, { year: 2026, month: 10, day: 16 })).toBeNull();
    expect(hoursFrom(forecast, { ...now, hour: 11 })[0]?.hour).toBe(11);
  });

  it('resume cuándo empieza a llover y cuánto dura', () => {
    const hourly = hoursFrom(toForecast(openMeteoResponse()), now);
    expect(rainOutlook(hourly, 8)).toMatchObject({
      summary: 'Lluvia probable desde las 10:00 durante unas 3 horas',
      alertLabel: 'Aviso de lluvia · 10:00',
    });
    expect(rainOutlook(hourly, 8).bars[0]).toEqual({ label: 'Ahora', intensity: 0.1 });
    expect(rainOutlook(hourly.map((h) => ({ ...h, probability: 0 })), 8)).toEqual(
      expect.objectContaining({ summary: 'Sin lluvia prevista en las próximas 8 horas' }),
    );
    expect(rainOutlook([{ hour: 8, probability: 0.9 }, { hour: 9, probability: 0.1 }], 8).summary).toBe('Lluvia ahora durante una hora');
  });

  it('conoce los códigos de tiempo', () => {
    expect(describeWeatherCode(0).icon).toBe('sun');
    expect(describeWeatherCode(45).icon).toBe('fog');
    expect(describeWeatherCode(73).icon).toBe('snow');
    expect(describeWeatherCode(81).label).toBe('Chubascos');
  });

  it('pide la previsión en la zona del usuario y falla si la respuesta no es válida', async () => {
    const ok = fakeFetch(() => ({ body: openMeteoResponse() }));
    await new OpenMeteo(ok, { lat: 40, lon: -3 }, TZ).forecast();
    expect(ok.urls[0]).toContain('timezone=Europe%2FMadrid');
    await expect(new OpenMeteo(fakeFetch(() => ({ body: { nada: 1 } })), { lat: 40, lon: -3 }, TZ).forecast()).rejects.toThrow('inesperada');
    await expect(new OpenMeteo(fakeFetch(() => ({ status: 503, body: {} })), { lat: 40, lon: -3 }, TZ).forecast()).rejects.toThrow('503');
  });
});
