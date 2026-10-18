import ICAL from 'ical.js';
import type { CivilDate } from '../../../../lib/month-grid';

/** Evento ya expandido (una entrada por ocurrencia). */
export interface CalendarEvent {
  id: string;
  title: string;
  location?: string;
  allDay: boolean;
  /** Eventos con hora: instantes reales. */
  start: Date;
  end: Date;
  /** Eventos de todo el día: días civiles, con `endDay` exclusivo (como en iCalendar). */
  startDay?: CivilDate;
  endDay?: CivilDate;
}

export interface Range {
  start: Date;
  end: Date;
}

/** Límite de ocurrencias por evento repetido, por si una regla no tiene fin. */
const MAX_OCCURRENCES = 2000;

const civil = (t: ICAL.Time): CivilDate => ({ year: t.year, month: t.month, day: t.day });

/**
 * Lee los VEVENT de un objeto iCalendar y devuelve las ocurrencias que se solapan con `range`.
 * Los eventos de todo el día se convierten a instantes con `dayToDate` (medianoche local del usuario).
 */
export function parseEvents(ics: string, range: Range, dayToDate: (day: CivilDate) => Date): CalendarEvent[] {
  const root = new ICAL.Component(ICAL.parse(ics));
  for (const vtimezone of root.getAllSubcomponents('vtimezone')) {
    ICAL.TimezoneService.register(vtimezone);
  }
  const components = root.getAllSubcomponents('vevent');
  const masters = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Event[] = [];
  for (const component of components) {
    const event = new ICAL.Event(component);
    if (component.hasProperty('recurrence-id')) exceptions.push(event);
    else masters.set(event.uid, event);
  }
  for (const exception of exceptions) {
    const master = masters.get(exception.uid);
    if (master) master.relateException(exception);
    else masters.set(`${exception.uid}#${exception.recurrenceId?.toString()}`, exception);
  }

  const result: CalendarEvent[] = [];
  const add = (event: ICAL.Event, start: ICAL.Time, end: ICAL.Time, item: ICAL.Event) => {
    const allDay = start.isDate;
    const startDate = allDay ? dayToDate(civil(start)) : start.toJSDate();
    const endDate = allDay ? dayToDate(civil(end)) : end.toJSDate();
    if (startDate >= range.end || endDate <= range.start) return;
    if (item.component.getFirstPropertyValue('status') === 'CANCELLED') return;
    const location = item.location?.trim();
    result.push({
      id: `${event.uid}@${start.toString()}`,
      title: item.summary?.trim() || 'Sin título',
      ...(location ? { location } : {}),
      allDay,
      start: startDate,
      end: endDate,
      ...(allDay ? { startDay: civil(start), endDay: civil(end) } : {}),
    });
  };

  for (const event of masters.values()) {
    if (!event.startDate) continue;
    const end = event.endDate ?? event.startDate;
    if (!event.isRecurring()) {
      add(event, event.startDate, end, event);
      continue;
    }
    const iterator = event.iterator();
    for (let i = 0, next = iterator.next(); next && i < MAX_OCCURRENCES; i++, next = iterator.next()) {
      const details = event.getOccurrenceDetails(next);
      const startDate = details.startDate.isDate ? dayToDate(civil(details.startDate)) : details.startDate.toJSDate();
      if (startDate >= range.end) break;
      add(event, details.startDate, details.endDate, details.item);
    }
  }
  return result.sort((a, b) => a.start.getTime() - b.start.getTime());
}
