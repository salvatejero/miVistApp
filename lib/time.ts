import type { CivilDate } from './month-grid';

export interface ZonedDateTime extends CivilDate {
  hour: number;
  minute: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Fecha y hora civiles de un instante en una zona horaria. */
export function zoned(date: Date, timeZone: string): ZonedDateTime {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** 08:30 en la zona horaria indicada. */
export const hhmm = (date: Date, timeZone: string): string => {
  const { hour, minute } = zoned(date, timeZone);
  return `${pad(hour)}:${pad(minute)}`;
};

/** Mismo día civil. */
export const sameDay = (a: CivilDate, b: CivilDate): boolean => a.year === b.year && a.month === b.month && a.day === b.day;

/** Día civil siguiente. */
export function nextDay({ year, month, day }: CivilDate): CivilDate {
  const d = new Date(Date.UTC(year, month - 1, day + 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Instante de una fecha y hora civiles en una zona horaria (09:00 en Madrid sigue siendo 09:00 tras el cambio de hora). */
export function zonedInstant({ year, month, day }: CivilDate, hour: number, minute: number, timeZone: string): Date {
  // Se parte de esa hora en UTC y se corrige por la diferencia horaria de ese momento (dos pasadas por si cruza un cambio de hora).
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const z = zoned(new Date(guess), timeZone);
    guess -= Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute) - target;
  }
  return new Date(guess);
}

/** Instante en que empieza un día civil en una zona horaria (medianoche local). */
export const startOfDay = (day: CivilDate, timeZone: string): Date => zonedInstant(day, 0, 0, timeZone);

/** Espera `ms` o lo que tarde `promise`, lo que ocurra antes. Devuelve null si se acaba el tiempo. */
export async function within<T>(promise: Promise<T>, ms: number): Promise<{ value: T } | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([promise.then((value) => ({ value })), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export const addMinutes = (date: Date, minutes: number): Date => new Date(date.getTime() + minutes * 60_000);

/** Minutos enteros de `from` a `to` (redondeando hacia arriba: "faltan 1 min" hasta que llega). */
export const minutesBetween = (from: Date, to: Date): number => Math.ceil((to.getTime() - from.getTime()) / 60_000);
