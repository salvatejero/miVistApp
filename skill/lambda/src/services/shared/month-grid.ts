import type { CalendarCell } from '../../contracts';
import { weekdayIndex } from './labels';

export interface CivilDate {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
}

export const daysInMonth = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Suma meses a un año/mes (1–12). */
export function addMonths(year: number, month: number, offset: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + offset;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/**
 * Celdas del mes en semanas completas de lunes a domingo, con los días del mes anterior y
 * siguiente que las completan (35 o 42 celdas; 28 si febrero empieza en lunes y no es bisiesto).
 */
export function buildMonthGrid(year: number, month: number, today: CivilDate, eventDays: ReadonlySet<number>): CalendarCell[] {
  const cells: CalendarCell[] = [];
  const leading = weekdayIndex(year, month, 1);
  const previous = addMonths(year, month, -1);
  const previousDays = daysInMonth(previous.year, previous.month);
  for (let i = leading; i > 0; i--) {
    cells.push({ day: previousDays - i + 1, inMonth: false, isToday: false, hasEvents: false });
  }
  const isCurrentMonth = today.year === year && today.month === month;
  for (let day = 1; day <= daysInMonth(year, month); day++) {
    cells.push({ day, inMonth: true, isToday: isCurrentMonth && today.day === day, hasEvents: eventDays.has(day) });
  }
  for (let day = 1; cells.length % 7 !== 0; day++) {
    cells.push({ day, inMonth: false, isToday: false, hasEvents: false });
  }
  return cells;
}
