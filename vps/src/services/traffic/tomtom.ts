import type { Coordinates } from '../../config';
import type { Fetch } from '../../http';
import { getJson, SourceError } from '../../http';

export interface Route {
  travelMinutes: number;
  trafficDelayMinutes: number;
}

/** Texto del estado del tráfico según el retraso que añade. */
export function trafficLabel(delayMinutes: number): string {
  if (delayMinutes <= 2) return 'Tráfico fluido';
  if (delayMinutes <= 10) return 'Tráfico moderado';
  return 'Tráfico denso';
}

const point = ({ lat, lon }: Coordinates): string => `${lat},${lon}`;

/** Rutas con tráfico en vivo y búsqueda de direcciones de TomTom. La clave nunca se registra. */
export class TomTom {
  constructor(
    private readonly fetchFn: Fetch,
    private readonly apiKey: string,
  ) {}

  async route(from: Coordinates, to: Coordinates): Promise<Route> {
    const params = new URLSearchParams({ key: this.apiKey, traffic: 'true', travelMode: 'car', departAt: 'now' });
    const data = (await getJson(
      this.fetchFn,
      `https://api.tomtom.com/routing/1/calculateRoute/${point(from)}:${point(to)}/json?${params}`,
    )) as { routes?: Array<{ summary?: { travelTimeInSeconds?: number; trafficDelayInSeconds?: number } }> };
    const summary = data.routes?.[0]?.summary;
    if (typeof summary?.travelTimeInSeconds !== 'number') throw new SourceError('Respuesta de rutas de TomTom inesperada');
    return {
      travelMinutes: Math.round(summary.travelTimeInSeconds / 60),
      trafficDelayMinutes: Math.round((summary.trafficDelayInSeconds ?? 0) / 60),
    };
  }

  /** Coordenadas de un texto de ubicación, o null si TomTom no lo encuentra. `near` orienta la búsqueda. */
  async geocode(query: string, near?: Coordinates): Promise<Coordinates | null> {
    const params = new URLSearchParams({ key: this.apiKey, limit: '1', language: 'es-ES' });
    if (near) {
      params.set('lat', String(near.lat));
      params.set('lon', String(near.lon));
    }
    const data = (await getJson(
      this.fetchFn,
      `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(query)}.json?${params}`,
    )) as { results?: Array<{ position?: { lat?: number; lon?: number } }> };
    const position = data.results?.[0]?.position;
    if (typeof position?.lat !== 'number' || typeof position.lon !== 'number') return null;
    return { lat: position.lat, lon: position.lon };
  }
}
