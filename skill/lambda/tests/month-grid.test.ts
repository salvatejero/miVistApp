import { describe, expect, it } from 'vitest';
import { monthLabel, shortDateLabel } from '../../../lib/labels';
import { addMonths, buildMonthGrid } from '../../../lib/month-grid';

const today = { year: 2026, month: 10, day: 15 };

describe('rejilla del mes', () => {
  it('octubre de 2026 empieza en jueves y ocupa 5 semanas', () => {
    const cells = buildMonthGrid(2026, 10, today, new Set([15, 20]));
    expect(cells).toHaveLength(35);
    expect(cells.slice(0, 3).map((c) => [c.day, c.inMonth])).toEqual([[28, false], [29, false], [30, false]]);
    expect(cells.filter((c) => c.isToday).map((c) => c.day)).toEqual([15]);
    expect(cells.filter((c) => c.hasEvents).map((c) => c.day)).toEqual([15, 20]);
    expect(cells.filter((c) => c.isSelected).map((c) => c.day)).toEqual([15]);
    expect(cells.at(-1)).toEqual({ day: 1, inMonth: false, isToday: false, isSelected: false, hasEvents: false });
  });

  it('febrero de 2027 cabe en 4 semanas justas', () => {
    expect(buildMonthGrid(2027, 2, today, new Set())).toHaveLength(28);
  });

  it('agosto de 2026 necesita 6 semanas', () => {
    expect(buildMonthGrid(2026, 8, today, new Set())).toHaveLength(42);
  });

  it('cuenta el 29 de febrero en años bisiestos', () => {
    const cells = buildMonthGrid(2028, 2, today, new Set());
    expect(cells.filter((c) => c.inMonth)).toHaveLength(29);
  });

  it('marca el día pulsado solo dentro del mes', () => {
    const cells = buildMonthGrid(2026, 10, today, new Set(), 1);
    expect(cells.filter((c) => c.isSelected).map((c) => [c.day, c.inMonth])).toEqual([[1, true]]);
  });

  it('solo marca hoy en el mes de hoy', () => {
    expect(buildMonthGrid(2026, 11, today, new Set()).some((c) => c.isToday)).toBe(false);
  });

  it('suma meses cruzando años', () => {
    expect(addMonths(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths(2026, 10, -22)).toEqual({ year: 2024, month: 12 });
  });

  it('escribe las fechas en español', () => {
    expect(monthLabel(2026, 10)).toBe('Octubre 2026');
    expect(shortDateLabel(2026, 10, 15)).toBe('Jue 15 oct');
  });
});
