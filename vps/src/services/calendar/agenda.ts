import type { AgendaDay, AgendaItem, CalendarCell, Departure } from '../../../../contracts/types';
import { MONTHS, shortDateLabel, WEEKDAYS_SHORT, monthLabel } from '../../../../lib/labels';
import type { CivilDate } from '../../../../lib/month-grid';
import { buildMonthGrid, daysInMonth } from '../../../../lib/month-grid';
import { hhmm, nextDay, sameDay, zoned } from '../../../../lib/time';
import type { CalendarEvent } from './ical';

/** Días civiles (en `timeZone`) que toca un evento. */
export function eventDays(event: CalendarEvent, timeZone: string): CivilDate[] {
  const first = event.allDay ? event.startDay! : zoned(event.start, timeZone);
  // El final es exclusivo: un evento que acaba a medianoche (o un todo el día de un día) no toca el día siguiente.
  const last = event.allDay ? event.endDay! : zoned(new Date(event.end.getTime() - 1), timeZone);
  const days: CivilDate[] = [];
  let day: CivilDate = { year: first.year, month: first.month, day: first.day };
  const isAfter = (a: CivilDate, b: CivilDate) => a.year * 10000 + a.month * 100 + a.day > b.year * 10000 + b.month * 100 + b.day;
  for (let i = 0; i < 366 && (event.allDay ? isAfter(last, day) : !isAfter(day, last)); i++) {
    days.push(day);
    day = nextDay(day);
  }
  return days.length ? days : [{ year: first.year, month: first.month, day: first.day }];
}

const toItem = (event: CalendarEvent, timeZone: string, departure?: Departure): AgendaItem => ({
  id: event.id,
  kind: 'event',
  title: event.title,
  timeLabel: event.allDay ? 'Todo el día' : hhmm(event.start, timeZone),
  ...(departure ? { departure } : {}),
});

/** Eventos de un día: los de todo el día primero y después por hora. */
export function agendaDay(
  title: string,
  day: CivilDate,
  events: CalendarEvent[],
  timeZone: string,
  departures: ReadonlyMap<string, Departure> = new Map(),
): AgendaDay {
  const items = events
    .filter((e) => eventDays(e, timeZone).some((d) => sameDay(d, day)))
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime())
    .map((e) => toItem(e, timeZone, departures.get(e.id)));
  return { title, dateLabel: shortDateLabel(day.year, day.month, day.day), items };
}

/**
 * Datos de la pantalla Calendario para un mes. El día seleccionado es `day` si existe en el mes; si no,
 * hoy si está en el mes, o el día 1.
 */
export function monthView(year: number, month: number, today: CivilDate, events: CalendarEvent[], timeZone: string, day?: number) {
  const withEvents = new Set<number>();
  for (const event of events) {
    for (const d of eventDays(event, timeZone)) if (d.year === year && d.month === month) withEvents.add(d.day);
  }
  const isCurrent = today.year === year && today.month === month;
  const valid = day !== undefined && Number.isInteger(day) && day >= 1 && day <= daysInMonth(year, month);
  const selected: CivilDate = valid ? { year, month, day } : isCurrent ? today : { year, month, day: 1 };
  const title = isCurrent && selected.day === today.day ? 'Hoy' : `${selected.day} ${MONTHS[month - 1]?.slice(0, 3)}`;
  return {
    monthLabel: monthLabel(year, month),
    weekdayLabels: [...WEEKDAYS_SHORT],
    cells: buildMonthGrid(year, month, today, withEvents, selected.day) as CalendarCell[],
    selectedDay: agendaDay(title, selected, events, timeZone),
  };
}
