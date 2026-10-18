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

/** Una ubicación de un evento a más de esto de casa no es un sitio al que ir hoy. */
const GEOCODE_RADIUS_M = 100_000;
/** Confianza mínima de TomTom en que el resultado es la dirección buscada (0–1). */
const MIN_GEOCODE_SCORE = 0.5;

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

  /**
   * Coordenadas de un texto de ubicación, o null si TomTom no lo encuentra con confianza.
   * Con `near`, solo acepta resultados a menos de `GEOCODE_RADIUS_M` de ese punto.
   */
  async geocode(query: string, near?: Coordinates): Promise<Coordinates | null> {
    const params = new URLSearchParams({ key: this.apiKey, limit: '1', language: 'es-ES' });
    if (near) {
      params.set('lat', String(near.lat));
      params.set('lon', String(near.lon));
      params.set('radius', String(GEOCODE_RADIUS_M));
    }
    const data = (await getJson(
      this.fetchFn,
      `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(query)}.json?${params}`,
    )) as { results?: Array<{ position?: { lat?: number; lon?: number }; matchConfidence?: { score?: number } }> };
    const result = data.results?.[0];
    const position = result?.position;
    if (typeof position?.lat !== 'number' || typeof position.lon !== 'number') return null;
    if ((result?.matchConfidence?.score ?? 1) < MIN_GEOCODE_SCORE) return null;
    return { lat: position.lat, lon: position.lon };
  }
}
