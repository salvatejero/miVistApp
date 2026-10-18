import type { AgendaItem, CalendarScreen, DashboardData, HomeScreen, HouseScreen, WeatherScreen } from '../../contracts';
import { longDateLabel } from '../../../../../lib/labels';
import { hhmm, sameDay, zoned } from '../../../../../lib/time';
import type { CacheStore } from './cache-store';

const OFFLINE = 'Sin conexión con el servidor';

type AnySection = { status: string; notice?: string };

const withNotice = <T extends AnySection>(section: T, notice: string): T =>
  section.status === 'ok' ? { ...section, notice } : section;

const offline = { status: 'error' as const, message: OFFLINE };

const withoutDeparture = (item: AgendaItem): AgendaItem => {
  const copy = { ...item };
  delete copy.departure;
  return copy;
};

/** Registra fallos sin datos personales. */
const log = (what: string, error: unknown) => console.error(what, error instanceof Error ? `${error.name}: ${error.message}` : 'Error');

/**
 * Pide los datos al VPS y guarda cada respuesta buena. Si el VPS no responde, pinta la última respuesta
 * con "Sin conexión · actualizado a las hh:mm" en cada bloque. Nunca muestra un aviso de salida guardado:
 * con datos de tráfico viejos podría hacer salir tarde.
 */
export class CachedDashboardData implements DashboardData {
  constructor(
    private readonly remote: DashboardData,
    private readonly store: CacheStore,
    private readonly timeZone: string,
    private readonly now: () => number = Date.now,
  ) {}

  private notice(savedAt: number): string {
    const saved = new Date(savedAt);
    const time = hhmm(saved, this.timeZone);
    if (sameDay(zoned(saved, this.timeZone), zoned(new Date(this.now()), this.timeZone))) return `Sin conexión · actualizado a las ${time}`;
    const { day, month } = zoned(saved, this.timeZone);
    return `Sin conexión · actualizado el ${day}/${month} a las ${time}`;
  }

  private async load<T>(key: string, fetchRemote: () => Promise<T>, stale: (value: T, notice: string) => T, fallback: T): Promise<T> {
    try {
      const value = await fetchRemote();
      await this.store.set(key, value, this.now()).catch((error: unknown) => log('No se pudo guardar la caché:', error));
      return value;
    } catch (error) {
      log('VPS no disponible:', error);
      const cached = await this.store.get(key).catch((e: unknown) => {
        log('No se pudo leer la caché:', e);
        return undefined;
      });
      return cached ? stale(cached.value as T, this.notice(cached.savedAt)) : fallback;
    }
  }

  getHome(): Promise<HomeScreen> {
    const today = zoned(new Date(this.now()), this.timeZone);
    return this.load(
      'home',
      () => this.remote.getHome(),
      (home, notice) => ({
        ...home,
        weather: withNotice(home.weather, notice),
        rainForecast: withNotice(home.rainForecast, notice),
        commute: withNotice(home.commute, notice),
        agenda:
          home.agenda.status === 'ok'
            ? {
                ...home.agenda,
                notice,
                // Sin el trayecto guardado: "Sal hh:mm" con tráfico viejo no sirve.
                today: { ...home.agenda.today, items: home.agenda.today.items.map(withoutDeparture) },
              }
            : home.agenda,
        house: withNotice(home.house, notice),
        departureAlert: null,
      }),
      {
        generatedAt: new Date(this.now()).toISOString(),
        header: { dateLabel: longDateLabel(today.year, today.month, today.day) },
        weather: offline,
        rainForecast: offline,
        commute: offline,
        agenda: offline,
        house: offline,
        departureAlert: null,
      },
    );
  }

  getCalendar(monthOffset: number): Promise<CalendarScreen> {
    return this.load(`calendar:${monthOffset}`, () => this.remote.getCalendar(monthOffset), withNotice, offline);
  }

  getWeather(): Promise<WeatherScreen> {
    return this.load('weather', () => this.remote.getWeather(), withNotice, offline);
  }

  getHouse(): Promise<HouseScreen> {
    return this.load('house', () => this.remote.getHouse(), withNotice, offline);
  }

  /** Las acciones van siempre al VPS; si no responde, el error sube al handler, que lo dice en voz. */
  toggleDevice(id: string): Promise<void> {
    return this.remote.toggleDevice(id);
  }

  turnAllOff(): Promise<void> {
    return this.remote.turnAllOff();
  }
}
