import { describe, expect, it } from 'vitest';
import { TomTom, trafficLabel } from '../src/services/traffic/tomtom';
import { fakeFetch } from './helpers';

describe('TomTom', () => {
  it('lee el trayecto con tráfico', async () => {
    const fetchFn = fakeFetch(() => ({ body: { routes: [{ summary: { travelTimeInSeconds: 1690, trafficDelayInSeconds: 420 } }] } }));
    expect(await new TomTom(fetchFn, 'clave').route({ lat: 40, lon: -3 }, { lat: 40.1, lon: -3.1 })).toEqual({ travelMinutes: 28, trafficDelayMinutes: 7 });
    expect(fetchFn.urls[0]).toContain('/calculateRoute/40,-3:40.1,-3.1/json');
    expect(fetchFn.urls[0]).toContain('traffic=true');
  });

  it('geocodifica y devuelve null si no encuentra la dirección', async () => {
    const found = fakeFetch(() => ({ body: { results: [{ position: { lat: 40.2, lon: -3.2 } }] } }));
    expect(await new TomTom(found, 'clave').geocode('Centro de salud')).toEqual({ lat: 40.2, lon: -3.2 });
    expect(await new TomTom(fakeFetch(() => ({ body: { results: [] } })), 'clave').geocode('???')).toBeNull();
  });

  it('falla con respuestas inesperadas o errores HTTP', async () => {
    await expect(new TomTom(fakeFetch(() => ({ body: {} })), 'clave').route({ lat: 0, lon: 0 }, { lat: 1, lon: 1 })).rejects.toThrow();
    await expect(new TomTom(fakeFetch(() => ({ status: 403, body: {} })), 'clave').route({ lat: 0, lon: 0 }, { lat: 1, lon: 1 })).rejects.toThrow('403');
  });

  it('describe el tráfico por el retraso', () => {
    expect(trafficLabel(1)).toBe('Tráfico fluido');
    expect(trafficLabel(7)).toBe('Tráfico moderado');
    expect(trafficLabel(15)).toBe('Tráfico denso');
  });
});
