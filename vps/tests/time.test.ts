import { describe, expect, it } from 'vitest';
import { hhmm, minutesBetween, nextDay, startOfDay, zoned } from '../../lib/time';
import { TZ } from './helpers';

describe('horas en la zona del usuario', () => {
  it('convierte instantes a hora de Madrid en verano y en invierno', () => {
    expect(hhmm(new Date('2026-07-01T06:30:00Z'), TZ)).toBe('08:30');
    expect(hhmm(new Date('2026-12-01T07:30:00Z'), TZ)).toBe('08:30');
  });

  it('calcula la medianoche local, también los días de cambio de hora', () => {
    expect(startOfDay({ year: 2026, month: 10, day: 15 }, TZ).toISOString()).toBe('2026-10-14T22:00:00.000Z');
    expect(startOfDay({ year: 2026, month: 10, day: 25 }, TZ).toISOString()).toBe('2026-10-24T22:00:00.000Z');
    expect(startOfDay({ year: 2026, month: 10, day: 26 }, TZ).toISOString()).toBe('2026-10-25T23:00:00.000Z');
    expect(startOfDay({ year: 2026, month: 3, day: 29 }, TZ).toISOString()).toBe('2026-03-28T23:00:00.000Z');
  });

  it('pasa de mes y de año', () => {
    expect(nextDay({ year: 2026, month: 12, day: 31 })).toEqual({ year: 2027, month: 1, day: 1 });
    expect(zoned(new Date('2026-12-31T23:30:00Z'), TZ)).toMatchObject({ year: 2027, month: 1, day: 1, hour: 0 });
  });

  it('redondea los minutos hacia arriba', () => {
    expect(minutesBetween(new Date('2026-10-15T08:00:00Z'), new Date('2026-10-15T08:00:30Z'))).toBe(1);
    expect(minutesBetween(new Date('2026-10-15T08:00:00Z'), new Date('2026-10-15T07:59:30Z'))).toBe(-0);
  });
});
