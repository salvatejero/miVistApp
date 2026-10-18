import { DAVClient } from 'tsdav';
import type { CivilDate } from '../../../../lib/month-grid';
import type { Fetch } from '../../http';
import { fetchWithTimeout, SourceError } from '../../http';
import type { CalendarEvent, Range } from './ical';
import { parseEvents } from './ical';

export interface CalendarSource {
  events(range: Range): Promise<CalendarEvent[]>;
}

const nameOf = (displayName: unknown): string => (typeof displayName === 'string' ? displayName : '');

/**
 * Calendarios de iCloud por CalDAV, con el Apple ID y una contraseña de app.
 * Si `calendars` tiene nombres, solo se leen esos; si no, todos los que admiten eventos.
 */
export class ICloudCalendar implements CalendarSource {
  private client?: DAVClient;

  constructor(
    private readonly credentials: { username: string; appPassword: string; calendars: string[] },
    private readonly dayToDate: (day: CivilDate) => Date,
    private readonly fetchFn?: Fetch,
  ) {}

  async events(range: Range): Promise<CalendarEvent[]> {
    const client = await this.connect();
    const calendars = (await client.fetchCalendars()).filter(
      (c) =>
        (c.components?.includes('VEVENT') ?? true) &&
        (this.credentials.calendars.length === 0 || this.credentials.calendars.includes(nameOf(c.displayName))),
    );
    // Un nombre mal escrito en ICLOUD_CALENDARS no debe parecer un calendario vacío.
    if (calendars.length === 0) throw new SourceError('Ningún calendario coincide con ICLOUD_CALENDARS');
    const timeRange = { start: range.start.toISOString(), end: range.end.toISOString() };
    const objects = (await Promise.all(calendars.map((calendar) => client.fetchCalendarObjects({ calendar, timeRange })))).flat();
    return objects
      .filter((o) => typeof o.data === 'string')
      .flatMap((o) => parseEvents(o.data as string, range, this.dayToDate))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  private async connect(): Promise<DAVClient> {
    if (this.client) return this.client;
    const client = new DAVClient({
      serverUrl: 'https://caldav.icloud.com',
      credentials: { username: this.credentials.username, password: this.credentials.appPassword },
      authMethod: 'Basic',
      defaultAccountType: 'caldav',
      fetch: fetchWithTimeout(this.fetchFn ?? fetch),
    });
    await client.login();
    this.client = client;
    return client;
  }
}
