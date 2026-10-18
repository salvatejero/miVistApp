import type { AgendaItem, CalendarScreen, DashboardData, HomeScreen, HouseScreen, WeatherScreen } from '../../contracts';
import { longDateLabel } from '../../../../../lib/labels';
import { hhmm, sameDay, within, zoned } from '../../../../../lib/time';
import type { Cached, CacheStore } from './cache-store';

/** Tiempo máximo para leer o guardar en la caché: si DynamoDB va lento, se sigue sin ella. */
const STORE_TIMEOUT_MS = 1000;

const OFFLINE = 'Sin conexión con el servidor';
const UPDATING = 'Actualizando…';

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

  private async read(key: string): Promise<Cached | undefined> {
    try {
      return (await within(this.store.get(key), STORE_TIMEOUT_MS))?.value;
    } catch (error) {
      log('No se pudo leer la caché:', error);
      return undefined;
    }
  }

  private async write(key: string, value: unknown): Promise<void> {
    try {
      await within(this.store.set(key, value, this.now()), STORE_TIMEOUT_MS);
    } catch (error) {
      log('No se pudo guardar la caché:', error);
    }
  }

  private async load<T>(
    key: string,
    fetchRemote: () => Promise<T>,
    stale: (value: T, notice: string, savedAt: number) => T,
    fallback: T,
  ): Promise<T> {
    try {
      const value = await fetchRemote();
      await this.write(key, value);
      return value;
    } catch (error) {
      log('VPS no disponible:', error);
      const cached = await this.read(key);
      return cached ? stale(cached.value as T, this.notice(cached.savedAt), cached.savedAt) : fallback;
    }
  }

  /**
   * Inicio guardado con el aviso en cada bloque y sin nada que dependa del tráfico de entonces.
   * La fecha de la cabecera es la de hoy; si lo guardado es de otro día, su "Hoy" ya no vale y la
   * agenda dice que no hay conexión.
   */
  private staleHome = (home: HomeScreen, notice: string, savedAt: number): HomeScreen => {
    const today = zoned(new Date(this.now()), this.timeZone);
    const sameDayAgenda = sameDay(zoned(new Date(savedAt), this.timeZone), today);
    return {
      ...home,
      header: { dateLabel: longDateLabel(today.year, today.month, today.day) },
      weather: withNotice(home.weather, notice),
      rainForecast: withNotice(home.rainForecast, notice),
      commute: withNotice(home.commute, notice),
      agenda: !sameDayAgenda
        ? { status: 'error', message: 'Sin conexión con el calendario' }
        : home.agenda.status === 'ok'
          ? {
              ...home.agenda,
              notice,
              // Sin el trayecto guardado: "Sal hh:mm" con tráfico viejo no sirve.
              today: { ...home.agenda.today, items: home.agenda.today.items.map(withoutDeparture) },
            }
          : home.agenda,
      house: withNotice(home.house, notice),
      departureAlert: null,
    };
  };

  /**
   * Lo último guardado de una pantalla, marcado "Actualizando…", para pintarlo enseguida mientras
   * llegan los datos nuevos. `undefined` si no hay nada guardado.
   */
  async preview(key: string): Promise<unknown> {
    const cached = await this.read(key);
    if (!cached) return undefined;
    return key === 'home'
      ? this.staleHome(cached.value as HomeScreen, UPDATING, cached.savedAt)
      : withNotice(cached.value as AnySection, UPDATING);
  }

  getHome(): Promise<HomeScreen> {
    const today = zoned(new Date(this.now()), this.timeZone);
    return this.load(
      'home',
      () => this.remote.getHome(),
      this.staleHome,
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
