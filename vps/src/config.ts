// Configuración del servicio, leída de variables de entorno del VPS. Ningún valor real va en el repo:
// ver vps/.env.example y docs/vps.md.

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface Config {
  port: number;
  host: string;
  apiKey: string;
  timeZone: string;
  /** Nombre que se muestra junto al tiempo. */
  cityLabel: string;
  home?: Coordinates;
  work?: Coordinates;
  /** Hora de entrada al trabajo (HH:mm) para la tarjeta de tráfico. */
  workStart: string;
  routeLabel: string;
  tomtomApiKey?: string;
  icloud?: { username: string; appPassword: string; calendars: string[] };
  departure: {
    bufferMinutes: number;
    /** Minutos para salir a partir de los que aparece el aviso. */
    appearMinutes: number;
    /** Minutos para salir a partir de los que pasa a "falta poco". */
    soonMinutes: number;
  };
  /** Cada cuánto se vuelve a pedir cada fuente, en minutos. */
  refresh: { weather: number; traffic: number; calendar: number };
}

export class ConfigError extends Error {
  override name = 'ConfigError';
}

type Env = Record<string, string | undefined>;

const text = (env: Env, name: string): string | undefined => {
  const value = env[name]?.trim();
  return value ? value : undefined;
};

function number(env: Env, name: string, fallback: number): number {
  const raw = text(env, name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new ConfigError(`${name} debe ser un número`);
  return value;
}

function coordinates(env: Env, prefix: string): Coordinates | undefined {
  const lat = text(env, `${prefix}_LAT`);
  const lon = text(env, `${prefix}_LON`);
  if (lat === undefined && lon === undefined) return undefined;
  const point = { lat: Number(lat), lon: Number(lon) };
  if (!(Math.abs(point.lat) <= 90 && Math.abs(point.lon) <= 180)) {
    throw new ConfigError(`${prefix}_LAT y ${prefix}_LON deben ser coordenadas válidas`);
  }
  return point;
}

export function loadConfig(env: Env = process.env): Config {
  const apiKey = text(env, 'VISTAPP_API_KEY');
  if (!apiKey || apiKey.length < 32) throw new ConfigError('VISTAPP_API_KEY es obligatoria y debe tener al menos 32 caracteres');

  const workStart = text(env, 'VISTAPP_WORK_START') ?? '09:00';
  if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(workStart)) throw new ConfigError('VISTAPP_WORK_START debe tener el formato HH:mm');

  const timeZone = text(env, 'VISTAPP_TIMEZONE') ?? 'Europe/Madrid';
  try {
    new Intl.DateTimeFormat('es-ES', { timeZone });
  } catch {
    throw new ConfigError(`VISTAPP_TIMEZONE no es una zona horaria válida: ${timeZone}`);
  }

  const username = text(env, 'ICLOUD_USERNAME');
  const appPassword = text(env, 'ICLOUD_APP_PASSWORD');

  const departure = {
    bufferMinutes: number(env, 'VISTAPP_BUFFER_MINUTES', 10),
    appearMinutes: number(env, 'VISTAPP_ALERT_APPEAR_MINUTES', 30),
    soonMinutes: number(env, 'VISTAPP_ALERT_SOON_MINUTES', 10),
  };
  if (!(departure.appearMinutes > departure.soonMinutes && departure.soonMinutes > 0)) {
    throw new ConfigError('Los umbrales del aviso deben cumplir APPEAR > SOON > 0');
  }

  return {
    port: number(env, 'PORT', 8787),
    host: text(env, 'HOST') ?? '127.0.0.1',
    apiKey,
    timeZone,
    cityLabel: text(env, 'VISTAPP_CITY_LABEL') ?? 'Casa',
    home: coordinates(env, 'VISTAPP_HOME'),
    work: coordinates(env, 'VISTAPP_WORK'),
    workStart,
    routeLabel: text(env, 'VISTAPP_ROUTE_LABEL') ?? 'Casa → Trabajo',
    tomtomApiKey: text(env, 'TOMTOM_API_KEY'),
    icloud:
      username && appPassword
        ? {
            username,
            appPassword,
            calendars: (text(env, 'ICLOUD_CALENDARS') ?? '')
              .split(',')
              .map((name) => name.trim())
              .filter(Boolean),
          }
        : undefined,
    departure,
    refresh: {
      weather: number(env, 'VISTAPP_REFRESH_WEATHER_MINUTES', 15),
      traffic: number(env, 'VISTAPP_REFRESH_TRAFFIC_MINUTES', 5),
      calendar: number(env, 'VISTAPP_REFRESH_CALENDAR_MINUTES', 5),
    },
  };
}
