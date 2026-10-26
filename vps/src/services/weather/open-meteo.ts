import type { RainBar, WeatherDay, WeatherIcon } from '../../../../contracts/types';
import { WEEKDAYS_SHORT, weekdayIndex } from '../../../../lib/labels';
import type { CivilDate } from '../../../../lib/month-grid';
import type { ZonedDateTime } from '../../../../lib/time';
import type { Coordinates } from '../../config';
import type { Fetch } from '../../http';
import { getJson, SourceError } from '../../http';

/**
 * Previsión con fechas y horas locales. "Hoy" y "Ahora" se deciden al componer la pantalla
 * (`weekFrom`, `hoursFrom`), no al pedirla: un dato guardado sigue bien etiquetado horas después.
 */
export interface Forecast {
  temperature: number;
  conditionLabel: string;
  icon: WeatherIcon;
  daily: Array<{ date: string; code: number; max: number; min: number; rainProbability: number }>;
  /** `time`: "2026-10-15T08" (hora local); `probability`: 0–1. */
  hourly: Array<{ time: string; hour: number; probability: number }>;
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
      forecast_days: '8',
    });
    const data = await getJson(this.fetchFn, `https://api.open-meteo.com/v1/forecast?${params}`);
    if (!isResponse(data)) throw new SourceError('Respuesta de Open-Meteo inesperada');
    return toForecast(data);
  }
}

/** Traduce la respuesta de Open-Meteo (horas locales, porque se pide con `timezone`). */
export function toForecast(data: OpenMeteoResponse): Forecast {
  const current = describeWeatherCode(data.current.weather_code);
  return {
    temperature: Math.round(data.current.temperature_2m),
    conditionLabel: current.label,
    icon: current.icon,
    daily: data.daily.time.map((date, i) => ({
      date,
      code: data.daily.weather_code[i] ?? 3,
      max: Math.round(data.daily.temperature_2m_max[i] ?? 0),
      min: Math.round(data.daily.temperature_2m_min[i] ?? 0),
      rainProbability: Math.round(data.daily.precipitation_probability_max[i] ?? 0),
    })),
    hourly: data.hourly.time.map((t, i) => ({
      time: t.slice(0, 13),
      hour: Number(t.slice(11, 13)),
      probability: (data.hourly.precipitation_probability[i] ?? 0) / 100,
    })),
  };
}

const pad = (n: number): string => String(n).padStart(2, '0');
const isoDay = ({ year, month, day }: CivilDate): string => `${year}-${pad(month)}-${pad(day)}`;

/** Los 7 días desde hoy, o null si la previsión guardada ya no los cubre. */
export function weekFrom(forecast: Forecast, today: CivilDate): WeatherDay[] | null {
  const days = forecast.daily.filter((d) => d.date >= isoDay(today)).slice(0, 7);
  if (days.length < 7) return null;
  return days.map((d, i) => {
    const { year, month, day } = civil(d.date);
    const weekday = WEEKDAYS_SHORT[weekdayIndex(year, month, day)] ?? '';
    return {
      name: i === 0 ? 'Hoy' : weekday,
      dateLabel: i === 0 ? `${weekday} ${day}` : String(day),
      isToday: i === 0,
      icon: describeWeatherCode(d.code).icon,
      maxTemp: d.max,
      minTemp: d.min,
      rainProbability: d.rainProbability,
    };
  });
}

/** Horas desde la actual (la primera es "Ahora"). */
export const hoursFrom = (forecast: Forecast, now: ZonedDateTime): Forecast['hourly'] =>
  forecast.hourly.filter((h) => h.time >= `${isoDay(now)}T${pad(now.hour)}`);

/** Probabilidad a partir de la que se considera que va a llover. */
const RAINY = 0.5;

const hourLabel = (hour: number): string => `${String(hour).padStart(2, '0')}:00`;

/** Barras y resumen de lluvia para las próximas `hours` horas. */
export function rainOutlook(hourly: Array<{ hour: number; probability: number }>, hours: number): { summary: string; bars: RainBar[]; alertLabel?: string } {
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
