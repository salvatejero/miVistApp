import { describe, expect, it } from 'vitest';
import { describeWeatherCode, OpenMeteo, rainOutlook, toForecast } from '../src/services/weather/open-meteo';
import { fakeFetch, openMeteoResponse, TZ } from './helpers';

describe('Open-Meteo', () => {
  it('traduce la respuesta a la semana y la lluvia por horas', () => {
    const forecast = toForecast(openMeteoResponse());
    expect(forecast).toMatchObject({ temperature: 19, conditionLabel: 'Nublado', icon: 'cloud' });
    expect(forecast.days).toHaveLength(7);
    expect(forecast.days[0]).toEqual({ name: 'Hoy', dateLabel: 'Jue 15', isToday: true, icon: 'cloud', maxTemp: 21, minTemp: 13, rainProbability: 80 });
    expect(forecast.days[1]).toMatchObject({ name: 'Vie', dateLabel: '16', icon: 'rain' });
    expect(forecast.days[6]?.icon).toBe('storm');
    expect(forecast.hourly[0]).toEqual({ hour: 8, probability: 0.1 });
  });

  it('resume cuándo empieza a llover y cuánto dura', () => {
    const { hourly } = toForecast(openMeteoResponse());
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
