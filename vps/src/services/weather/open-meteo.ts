import type { RainBar, WeatherDay, WeatherIcon } from '../../../../contracts/types';
import { WEEKDAYS_SHORT, weekdayIndex } from '../../../../lib/labels';
import type { Coordinates } from '../../config';
import type { Fetch } from '../../http';
import { getJson, SourceError } from '../../http';

/** Tiempo ya traducido a lo que muestran las pantallas. */
export interface Forecast {
  temperature: number;
  conditionLabel: string;
  icon: WeatherIcon;
  days: WeatherDay[];
  /** Probabilidad de lluvia por horas desde la hora actual (0–1). */
  hourly: Array<{ hour: number; probability: number }>;
}

/** Códigos WMO que usa Open-Meteo → icono y texto. */
export function describeWeatherCode(code: number): { icon: WeatherIcon; label: string } {
  if (code === 0) return { icon: 'sun', label: 'Despejado' };
  if (code === 1) return { icon: 'partly-cloudy', label: 'Poco nuboso' };
  if (code === 2) return { icon: 'partly-cloudy', label: 'Intervalos nubosos' };
  if (code === 3) return { icon: 'cloud', label: 'Nublado' };
  if (code === 45 || code === 48) return { icon: 'fog', label: 'Niebla' };
  if (code >= 51 && code <= 57) return { icon: 'rain', label: 'Llovizna' };
  if (code === 65 || code === 67) return { icon: 'rain', label: 'Lluvia fuerte' };
  if (code >= 61 && code <= 67) return { icon: 'rain', label: 'Lluvia' };
  if (code >= 71 && code <= 77) return { icon: 'snow', label: 'Nieve' };
  if (code >= 80 && code <= 82) return { icon: 'rain', label: 'Chubascos' };
  if (code === 85 || code === 86) return { icon: 'snow', label: 'Chubascos de nieve' };
  if (code >= 95) return { icon: 'storm', label: 'Tormenta' };
  return { icon: 'cloud', label: 'Nublado' };
}

interface OpenMeteoResponse {
  current: { time: string; temperature_2m: number; weather_code: number };
  hourly: { time: string[]; precipitation_probability: Array<number | null> };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: Array<number | null>;
  };
}

function isResponse(value: unknown): value is OpenMeteoResponse {
  const v = value as Partial<OpenMeteoResponse> | null;
  return (
    typeof v?.current?.temperature_2m === 'number' &&
    Array.isArray(v.hourly?.time) &&
    Array.isArray(v.hourly?.precipitation_probability) &&
    Array.isArray(v.daily?.time) &&
    v.daily.time.length >= 7
  );
}

const civil = (isoDate: string) => {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number) as [number, number, number];
  return { year, month, day };
};

export class OpenMeteo {
  constructor(
    private readonly fetchFn: Fetch,
    private readonly place: Coordinates,
    private readonly timeZone: string,
  ) {}

  async forecast(): Promise<Forecast> {
    const params = new URLSearchParams({
      latitude: String(this.place.lat),
      longitude: String(this.place.lon),
      current: 'temperature_2m,weather_code',
      hourly: 'precipitation_probability',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      timezone: this.timeZone,
      forecast_days: '7',
    });
    const data = await getJson(this.fetchFn, `https://api.open-meteo.com/v1/forecast?${params}`);
    if (!isResponse(data)) throw new SourceError('Respuesta de Open-Meteo inesperada');
    return toForecast(data);
  }
}

/** Traduce la respuesta de Open-Meteo (horas locales, porque se pide con `timezone`). */
export function toForecast(data: OpenMeteoResponse): Forecast {
  const current = describeWeatherCode(data.current.weather_code);
  const currentHour = data.current.time.slice(0, 13); // "2026-10-15T08"
  const start = Math.max(0, data.hourly.time.findIndex((t) => t.startsWith(currentHour)));
  const hourly = data.hourly.time.slice(start).map((t, i) => ({
    hour: Number(t.slice(11, 13)),
    probability: (data.hourly.precipitation_probability[start + i] ?? 0) / 100,
  }));
  const days: WeatherDay[] = data.daily.time.slice(0, 7).map((date, i) => {
    const { year, month, day } = civil(date);
    const weekday = WEEKDAYS_SHORT[weekdayIndex(year, month, day)] ?? '';
    return {
      name: i === 0 ? 'Hoy' : weekday,
      dateLabel: i === 0 ? `${weekday} ${day}` : String(day),
      isToday: i === 0,
      icon: describeWeatherCode(data.daily.weather_code[i] ?? 3).icon,
      maxTemp: Math.round(data.daily.temperature_2m_max[i] ?? 0),
      minTemp: Math.round(data.daily.temperature_2m_min[i] ?? 0),
      rainProbability: Math.round(data.daily.precipitation_probability_max[i] ?? 0),
    };
  });
  return { temperature: Math.round(data.current.temperature_2m), conditionLabel: current.label, icon: current.icon, days, hourly };
}

/** Probabilidad a partir de la que se considera que va a llover. */
const RAINY = 0.5;

const hourLabel = (hour: number): string => `${String(hour).padStart(2, '0')}:00`;

/** Barras y resumen de lluvia para las próximas `hours` horas. */
export function rainOutlook(hourly: Forecast['hourly'], hours: number): { summary: string; bars: RainBar[]; alertLabel?: string } {
  const window = hourly.slice(0, hours);
  const bars = window.map((h, i) => ({ label: i === 0 ? 'Ahora' : `+${i}h`, intensity: Math.round(h.probability * 100) / 100 }));
  const first = window.findIndex((h) => h.probability >= RAINY);
  if (first === -1) return { summary: `Sin lluvia prevista en las próximas ${window.length} horas`, bars };
  let length = 0;
  while (window[first + length] && window[first + length]!.probability >= RAINY) length++;
  const duration = length === 1 ? 'una hora' : `unas ${length} horas`;
  const startHour = window[first]!.hour;
  return {
    summary: first === 0 ? `Lluvia ahora durante ${duration}` : `Lluvia probable desde las ${hourLabel(startHour)} durante ${duration}`,
    bars,
    alertLabel: first === 0 ? 'Lluvia ahora' : `Aviso de lluvia · ${hourLabel(startHour)}`,
  };
}
