import type {
  AgendaDay,
  CalendarScreen,
  DashboardData,
  Departure,
  DepartureAlert,
  HomeScreen,
  HouseScreen,
  WeatherScreen,
} from '../../contracts/types';
import { houseSummary, longDateLabel } from '../../lib/labels';
import type { CivilDate } from '../../lib/month-grid';
import { addMonths } from '../../lib/month-grid';
import { addMinutes, hhmm, nextDay, startOfDay, within, zoned, zonedInstant } from '../../lib/time';
import type { Config } from './config';
import type { Fetched } from './last-good';
import { LastGood } from './last-good';
import { agendaDay, monthView } from './services/calendar/agenda';
import type { CalendarSource } from './services/calendar/caldav';
import type { CalendarEvent } from './services/calendar/ical';
import type { HouseSource } from './services/home/mock-house';
import type { UpcomingEvent } from './services/traffic/departure-alert';
import { departureAlert, isPhysicalLocation, leaveTime } from './services/traffic/departure-alert';
import type { Route, TomTom } from './services/traffic/tomtom';
import { trafficLabel } from './services/traffic/tomtom';
import type { Forecast, OpenMeteo } from './services/weather/open-meteo';
import { hoursFrom, rainOutlook, weekFrom } from './services/weather/open-meteo';

export interface Sources {
  weather?: OpenMeteo;
  tomtom?: TomTom;
  calendar?: CalendarSource;
  house: HouseSource;
  now?: () => Date;
}

/** Solo se calcula el trayecto de eventos que empiezan dentro de este margen (más el umbral del aviso). */
const MAX_TRAVEL_MINUTES = 180;
/** Eventos con ubicación que se prueban si los primeros no se pueden geocodificar. */
const MAX_DEPARTURE_CANDIDATES = 3;
const HOME_RAIN_HOURS = 8;
/** Días de la franja de previsión de Inicio, empezando por hoy. */
const HOME_FORECAST_DAYS = 5;
const WEATHER_RAIN_HOURS = 12;
const HOME_DEVICES = 4;
const MAX_PLACES = 500;

/**
 * Tiempo máximo de cada bloque. La skill espera al VPS 5 s: un bloque lento responde con error (o su
 * último dato) a tiempo y los demás llegan bien. La consulta lenta sigue y deja el dato para el siguiente refresco.
 */
export const SECTION_BUDGET_MS = 3500;
/**
 * Si TomTom no responde, el aviso usa el último trayecto conocido marcado como estimado, pero solo si
 * tiene menos de esto: con un tráfico de hace horas es mejor no avisar.
 */
const MAX_ESTIMATED_ROUTE_MS = 60 * 60_000;
/** Tiempo para geocodificar y calcular el trayecto del aviso, dentro del plazo de la agenda. */
const DEPARTURE_BUDGET_MS = 1500;

class TooSlow extends Error {
  override name = 'TooSlow';
}

async function deadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  const result = await within(promise, ms);
  if (!result) throw new TooSlow(`Más de ${ms} ms`);
  return result.value;
}

/** Primera parte de la ubicación ("Centro de salud, Calle…" → "Centro de salud"): corta y sin la dirección. */
const placeLabel = (location: string): string => location.split(/[,\n]/)[0]!.trim();

/** Registra el fallo de una fuente sin datos personales (ni URLs, que pueden llevar claves). */
const logFailure = (source: string, error: unknown) =>
  console.error(`Fuente ${source} no disponible:`, error instanceof Error ? error.name : 'Error');

/** Compone las pantallas a partir de las fuentes reales. Implementa el mismo contrato que los datos de ejemplo. */
export class VpsDashboard implements DashboardData {
  private readonly now: () => Date;
  private readonly forecasts: LastGood<Forecast>;
  private readonly routes: LastGood<Route>;
  private readonly events: LastGood<CalendarEvent[]>;
  private readonly places = new Map<string, { lat: number; lon: number } | null>();

  constructor(
    private readonly config: Config,
    private readonly sources: Sources,
    private readonly budgetMs = SECTION_BUDGET_MS,
  ) {
    this.now = sources.now ?? (() => new Date());
    const clock = () => this.now().getTime();
    this.forecasts = new LastGood(config.refresh.weather * 60_000, clock);
    this.routes = new LastGood(config.refresh.traffic * 60_000, clock);
    this.events = new LastGood(config.refresh.calendar * 60_000, clock);
  }

  private notice(fetched: Fetched<unknown>): { notice?: string } {
    return fetched.staleSince ? { notice: `No actualizado · ${hhmm(fetched.staleSince, this.config.timeZone)}` } : {};
  }

  private today(): CivilDate {
    const { year, month, day } = zoned(this.now(), this.config.timeZone);
    return { year, month, day };
  }

  private dayToDate = (day: CivilDate): Date => startOfDay(day, this.config.timeZone);

  async getHome(): Promise<HomeScreen> {
    const today = this.today();
    const [weather, commute, agenda, house] = await Promise.all([
      this.homeWeather(),
      this.commute(today),
      this.agenda(today),
      this.houseDevices(),
    ]);
    return {
      generatedAt: this.now().toISOString(),
      header: { dateLabel: longDateLabel(today.year, today.month, today.day) },
      weather: weather.weather,
      rainForecast: weather.rain,
      commute,
      agenda: agenda.section,
      house: house.status === 'ok' ? { ...house, devices: house.devices.slice(0, HOME_DEVICES) } : house,
      departureAlert: agenda.alert,
    };
  }

  async getCalendar(monthOffset: number, day?: number): Promise<CalendarScreen> {
    const calendar = this.sources.calendar;
    if (!calendar) return { status: 'empty', message: 'Calendario sin configurar' };
    const today = this.today();
    const { year, month } = addMonths(today.year, today.month, monthOffset);
    const following = addMonths(year, month, 1);
    const range = {
      start: this.dayToDate({ year, month, day: 1 }),
      end: this.dayToDate({ year: following.year, month: following.month, day: 1 }),
    };
    try {
      const fetched = await deadline(this.events.get(`month:${year}-${month}`, () => calendar.events(range)), this.budgetMs);
      return { status: 'ok', ...monthView(year, month, today, fetched.value, this.config.timeZone, day), ...this.notice(fetched) };
    } catch (error) {
      logFailure('calendario', error);
      return { status: 'error', message: 'Sin conexión con el calendario' };
    }
  }

  async getWeather(): Promise<WeatherScreen> {
    const weather = this.sources.weather;
    if (!weather) return { status: 'empty', message: 'Tiempo sin configurar' };
    try {
      const fetched = await deadline(this.forecasts.get('forecast', () => weather.forecast()), this.budgetMs);
      const now = zoned(this.now(), this.config.timeZone);
      const days = weekFrom(fetched.value, now);
      if (!days) throw new TooSlow('Previsión guardada demasiado vieja');
      const rain = rainOutlook(hoursFrom(fetched.value, now), WEATHER_RAIN_HOURS);
      return {
        status: 'ok',
        city: this.config.cityLabel,
        days,
        hourlyRain: { status: 'ok', summary: rain.summary, bars: rain.bars },
        ...this.notice(fetched),
      };
    } catch (error) {
      logFailure('tiempo', error);
      return { status: 'error', message: 'No se pudo cargar el tiempo' };
    }
  }

  async getHouse(): Promise<HouseScreen> {
    const house = await this.houseDevices();
    return house.status === 'ok' ? { ...house, summary: houseSummary(house.devices) } : house;
  }

  toggleDevice(id: string): Promise<void> {
    return this.sources.house.toggle(id);
  }

  turnAllOff(): Promise<void> {
    return this.sources.house.allOff();
  }

  private async houseDevices(): Promise<Extract<HomeScreen['house'], { status: 'ok' }> | { status: 'error'; message: string }> {
    try {
      return { status: 'ok', devices: await deadline(this.sources.house.devices(), this.budgetMs) };
    } catch (error) {
      logFailure('casa', error);
      return { status: 'error', message: 'No se pudo conectar con la casa' };
    }
  }

  private async homeWeather(): Promise<Pick<HomeScreen, 'weather'> & { rain: HomeScreen['rainForecast'] }> {
    const weather = this.sources.weather;
    if (!weather) {
      return { weather: { status: 'empty', message: 'Tiempo sin configurar' }, rain: { status: 'empty', message: 'Tiempo sin configurar' } };
    }
    try {
      const fetched = await deadline(this.forecasts.get('forecast', () => weather.forecast()), this.budgetMs);
      const forecast = fetched.value;
      const now = zoned(this.now(), this.config.timeZone);
      const rain = rainOutlook(hoursFrom(forecast, now), HOME_RAIN_HOURS);
      const days = weekFrom(forecast, now)?.slice(0, HOME_FORECAST_DAYS);
      const notice = this.notice(fetched);
      return {
        weather: {
          status: 'ok',
          city: this.config.cityLabel,
          temperature: forecast.temperature,
          conditionLabel: forecast.conditionLabel,
          icon: forecast.icon,
          ...(rain.alertLabel ? { rainAlertLabel: rain.alertLabel } : {}),
          ...(days ? { forecast: days } : {}),
          ...notice,
        },
        rain: { status: 'ok', summary: rain.summary, bars: rain.bars, ...notice },
      };
    } catch (error) {
      logFailure('tiempo', error);
      return {
        weather: { status: 'error', message: 'Tiempo no disponible' },
        rain: { status: 'error', message: 'No se pudo cargar la lluvia' },
      };
    }
  }

  /** Hora de salir hacia el trabajo: hoy, o mañana si la hora de entrada de hoy ya ha pasado. */
  private nextWorkStart(today: CivilDate): Date {
    const [hours, minutes] = this.config.workStart.split(':').map(Number) as [number, number];
    const todayStart = zonedInstant(today, hours, minutes, this.config.timeZone);
    return todayStart > this.now() ? todayStart : zonedInstant(nextDay(today), hours, minutes, this.config.timeZone);
  }

  private async commute(today: CivilDate): Promise<HomeScreen['commute']> {
    const { tomtom } = this.sources;
    const { home, work } = this.config;
    if (!tomtom || !home || !work) return { status: 'empty', message: 'Tráfico sin configurar' };
    try {
      const fetched = await deadline(this.routes.get('commute', () => tomtom.route(home, work)), this.budgetMs);
      const leaveAt = leaveTime(this.nextWorkStart(today), fetched.value.travelMinutes, this.config.departure.bufferMinutes);
      return {
        status: 'ok',
        routeLabel: this.config.routeLabel,
        trafficLabel: trafficLabel(fetched.value.trafficDelayMinutes),
        durationMinutes: fetched.value.travelMinutes,
        leaveAt: hhmm(leaveAt, this.config.timeZone),
        ...this.notice(fetched),
      };
    } catch (error) {
      logFailure('tráfico', error);
      return { status: 'error', message: 'Tráfico no disponible' };
    }
  }

  private async agenda(today: CivilDate): Promise<{ section: HomeScreen['agenda']; alert: DepartureAlert | null }> {
    const calendar = this.sources.calendar;
    if (!calendar) return { section: { status: 'empty', message: 'Calendario sin configurar' }, alert: null };
    const tomorrow = nextDay(today);
    const range = { start: this.dayToDate(today), end: this.dayToDate(nextDay(tomorrow)) };
    let fetched: Fetched<CalendarEvent[]>;
    try {
      fetched = await deadline(
        this.events.get(`agenda:${today.year}-${today.month}-${today.day}`, () => calendar.events(range)),
        this.budgetMs - DEPARTURE_BUDGET_MS,
      );
    } catch (error) {
      logFailure('calendario', error);
      return { section: { status: 'error', message: 'Sin conexión con el calendario' }, alert: null };
    }
    // Si el trayecto tarda, esta vez no hay aviso; la consulta sigue y lo tendrá el siguiente refresco.
    const computed = await within(this.departure(fetched.value), DEPARTURE_BUDGET_MS);
    const { departure, alert } = computed?.value ?? { alert: null };
    const departures = new Map(departure ? [[departure.eventId, departure.info]] : []);
    const days: [AgendaDay, AgendaDay] = [
      agendaDay('Hoy', today, fetched.value, this.config.timeZone, departures),
      agendaDay('Mañana', tomorrow, fetched.value, this.config.timeZone),
    ];
    return { section: { status: 'ok', today: days[0], tomorrow: days[1], ...this.notice(fetched) }, alert };
  }

  /**
   * Aviso de salida del próximo evento con ubicación física que se pueda situar, dentro de la ventana.
   * Nunca lanza: si algo falla, no hay aviso.
   */
  private async departure(
    events: CalendarEvent[],
  ): Promise<{ departure?: { eventId: string; info: Departure }; alert: DepartureAlert | null }> {
    const { tomtom } = this.sources;
    const home = this.config.home;
    if (!tomtom || !home) return { alert: null };
    const now = this.now();
    const horizon = addMinutes(now, this.config.departure.appearMinutes + this.config.departure.bufferMinutes + MAX_TRAVEL_MINUTES);
    const candidates = events
      .filter((e) => !e.allDay && e.start > now && e.start <= horizon && isPhysicalLocation(e.location))
      .slice(0, MAX_DEPARTURE_CANDIDATES);
    try {
      for (const next of candidates) {
        const destination = await this.geocode(next.location!, home);
        if (!destination) continue;
        const fetched = await this.routes.get(`event:${next.id}`, () => tomtom.route(home, destination));
        // Si TomTom no responde, se avisa con el último trayecto marcado como estimado; si es de hace más de una hora, no.
        if (fetched.staleSince && now.getTime() - fetched.staleSince.getTime() > MAX_ESTIMATED_ROUTE_MS) return { alert: null };
        const route = fetched.value;
        // Un trayecto de horas no es una cita a la que se va desde casa (lugar mal situado).
        if (route.travelMinutes > MAX_TRAVEL_MINUTES) continue;
        const event: UpcomingEvent = {
          id: next.id,
          title: next.title,
          start: next.start,
          timeLabel: hhmm(next.start, this.config.timeZone),
          placeLabel: placeLabel(next.location!),
        };
        const rule = { ...this.config.departure, timeZone: this.config.timeZone };
        const travel = {
          travelMinutes: route.travelMinutes,
          trafficLabel: trafficLabel(route.trafficDelayMinutes),
          ...(fetched.staleSince ? { estimatedAt: fetched.staleSince } : {}),
        };
        const alert = departureAlert(event, travel, now, rule);
        const leave = leaveTime(next.start, route.travelMinutes, this.config.departure.bufferMinutes);
        return {
          departure: { eventId: next.id, info: { placeLabel: event.placeLabel, travelMinutes: route.travelMinutes, leaveAt: hhmm(leave, this.config.timeZone) } },
          alert,
        };
      }
    } catch (error) {
      logFailure('aviso de salida', error);
    }
    return { alert: null };
  }

  private async geocode(location: string, near: { lat: number; lon: number }) {
    if (this.places.has(location)) return this.places.get(location)!;
    const found = await this.sources.tomtom!.geocode(location, near);
    if (this.places.size >= MAX_PLACES) this.places.clear();
    this.places.set(location, found);
    return found;
  }
}
