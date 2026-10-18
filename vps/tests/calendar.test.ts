import { describe, expect, it } from 'vitest';
import { startOfDay } from '../../lib/time';
import { agendaDay, eventDays, monthView } from '../src/services/calendar/agenda';
import { parseEvents } from '../src/services/calendar/ical';
import { TZ } from './helpers';

const dayToDate = (day: { year: number; month: number; day: number }) => startOfDay(day, TZ);
const range = { start: new Date('2026-10-01T00:00:00+02:00'), end: new Date('2026-11-01T00:00:00+01:00') };

const VTIMEZONE = `BEGIN:VTIMEZONE
TZID:Europe/Madrid
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
END:VTIMEZONE`;

const calendar = (...events: string[]) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//prueba//ES', VTIMEZONE, ...events, 'END:VCALENDAR'].join('\r\n');

const event = (fields: string) => `BEGIN:VEVENT\r\nDTSTAMP:20261001T000000Z\r\n${fields.trim().split('\n').map((l) => l.trim()).join('\r\n')}\r\nEND:VEVENT`;

describe('eventos iCalendar', () => {
  it('lee un evento con zona horaria', () => {
    const ics = calendar(event(`
      UID:a
      SUMMARY:Revisión médica
      LOCATION:Centro de salud\\, Calle Falsa 1
      DTSTART;TZID=Europe/Madrid:20261015T100000
      DTEND;TZID=Europe/Madrid:20261015T103000`));
    const [e] = parseEvents(ics, range, dayToDate);
    expect(e).toMatchObject({ title: 'Revisión médica', location: 'Centro de salud, Calle Falsa 1', allDay: false });
    expect(e!.start.toISOString()).toBe('2026-10-15T08:00:00.000Z');
  });

  it('lee eventos de todo el día como días civiles', () => {
    const ics = calendar(event(`
      UID:b
      SUMMARY:Vacaciones
      DTSTART;VALUE=DATE:20261020
      DTEND;VALUE=DATE:20261023`));
    const [e] = parseEvents(ics, range, dayToDate);
    expect(e).toMatchObject({ allDay: true, startDay: { year: 2026, month: 10, day: 20 }, endDay: { year: 2026, month: 10, day: 23 } });
    expect(eventDays(e!, TZ).map((d) => d.day)).toEqual([20, 21, 22]);
  });

  it('expande eventos repetidos con excepciones y fechas excluidas', () => {
    const ics = calendar(
      event(`
        UID:c
        SUMMARY:Inglés
        DTSTART;TZID=Europe/Madrid:20261001T180000
        DTEND;TZID=Europe/Madrid:20261001T190000
        RRULE:FREQ=WEEKLY;BYDAY=TH
        EXDATE;TZID=Europe/Madrid:20261008T180000`),
      event(`
        UID:c
        RECURRENCE-ID;TZID=Europe/Madrid:20261015T180000
        SUMMARY:Inglés (cambiada)
        DTSTART;TZID=Europe/Madrid:20261015T190000
        DTEND;TZID=Europe/Madrid:20261015T200000`),
    );
    const events = parseEvents(ics, range, dayToDate);
    expect(events.map((e) => [e.start.toISOString(), e.title])).toEqual([
      ['2026-10-01T16:00:00.000Z', 'Inglés'],
      ['2026-10-15T17:00:00.000Z', 'Inglés (cambiada)'],
      ['2026-10-22T16:00:00.000Z', 'Inglés'],
      // 29 de octubre: ya en horario de invierno (UTC+1)
      ['2026-10-29T17:00:00.000Z', 'Inglés'],
    ]);
  });

  it('descarta eventos cancelados y fuera del rango', () => {
    const ics = calendar(
      event(`
        UID:d
        SUMMARY:Cancelado
        STATUS:CANCELLED
        DTSTART:20261015T080000Z
        DTEND:20261015T090000Z`),
      event(`
        UID:e
        SUMMARY:Noviembre
        DTSTART:20261110T080000Z
        DTEND:20261110T090000Z`),
    );
    expect(parseEvents(ics, range, dayToDate)).toEqual([]);
  });
});

describe('agenda y mes', () => {
  const ics = calendar(
    event(`
      UID:1
      SUMMARY:Reunión
      DTSTART;TZID=Europe/Madrid:20261015T123000
      DTEND;TZID=Europe/Madrid:20261015T133000`),
    event(`
      UID:2
      SUMMARY:Cumpleaños
      DTSTART;VALUE=DATE:20261015
      DTEND;VALUE=DATE:20261016`),
    event(`
      UID:3
      SUMMARY:Viaje
      DTSTART;TZID=Europe/Madrid:20261016T220000
      DTEND;TZID=Europe/Madrid:20261017T020000`),
  );
  const events = parseEvents(ics, range, dayToDate);
  const today = { year: 2026, month: 10, day: 15 };

  it('ordena el día con los de todo el día primero', () => {
    const day = agendaDay('Hoy', today, events, TZ);
    expect(day.dateLabel).toBe('Jue 15 oct');
    expect(day.items.map((i) => [i.timeLabel, i.title])).toEqual([
      ['Todo el día', 'Cumpleaños'],
      ['12:30', 'Reunión'],
    ]);
  });

  it('marca en el mes los días con eventos, también los que cruzan medianoche', () => {
    const view = monthView(2026, 10, today, events, TZ);
    expect(view.cells.filter((c) => c.hasEvents && c.inMonth).map((c) => c.day)).toEqual([15, 16, 17]);
    expect(view.selectedDay.title).toBe('Hoy');
    expect(monthView(2026, 11, today, events, TZ).selectedDay).toMatchObject({ title: '1 nov', items: [] });
  });
});
