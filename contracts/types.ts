// Tipos TypeScript del contrato de datos, compartidos por la skill y el servicio del VPS.
// Reflejan contracts/schemas/*.schema.json; si cambias uno, cambia el otro (los tests validan
// los fixtures y las salidas de los servicios contra los esquemas).

export type SectionStatus = 'ok' | 'empty' | 'error';

/**
 * Bloque de pantalla que puede fallar sin romper el resto. Si `status` no es `ok`, `message` es
 * obligatorio. `notice` marca datos que no son de ahora ("Sin conexión · actualizado a las 08:30").
 */
export type Section<T> =
  | ({ status: 'ok'; message?: string; notice?: string } & T)
  | { status: 'empty' | 'error'; message: string; notice?: string };

/** Hora local HH:mm (24 h). */
export type Time = string;

export type WeatherIcon = 'sun' | 'partly-cloudy' | 'cloud' | 'rain' | 'storm' | 'snow' | 'fog';

export interface RainBar {
  label: string;
  /** Altura relativa de la barra, 0–1. */
  intensity: number;
}

export type RainForecast = Section<{ summary: string; bars: RainBar[] }>;

export interface Departure {
  placeLabel: string;
  travelMinutes: number;
  leaveAt: Time;
}

export interface AgendaItem {
  id: string;
  kind: 'event' | 'reminder';
  title: string;
  timeLabel?: string;
  departure?: Departure;
}

export interface AgendaDay {
  title: string;
  dateLabel: string;
  items: AgendaItem[];
}

export type DepartureAlertState = 'appear' | 'soon' | 'leave_now';

export interface DepartureAlert {
  eventId: string;
  state: DepartureAlertState;
  eventTimeLabel: string;
  title: string;
  placeLabel: string;
  travelMinutes: number;
  trafficLabel?: string;
  leaveAt: Time;
  minutesToLeave: number;
  arriveAt: Time;
}

export interface Device {
  id: string;
  name: string;
  kind: 'light' | 'plug' | 'blind';
  on: boolean;
  stateLabel: string;
}

export interface HomeScreen {
  generatedAt: string;
  header: { dateLabel: string };
  weather: Section<{
    city: string;
    temperature: number;
    conditionLabel: string;
    icon: WeatherIcon;
    rainAlertLabel?: string;
  }>;
  rainForecast: RainForecast;
  commute: Section<{ routeLabel: string; trafficLabel: string; durationMinutes: number; leaveAt: Time }>;
  agenda: Section<{ today: AgendaDay; tomorrow: AgendaDay }>;
  house: Section<{ devices: Device[] }>;
  departureAlert: DepartureAlert | null;
}

export interface CalendarCell {
  day: number;
  inMonth: boolean;
  isToday: boolean;
  hasEvents: boolean;
}

export type CalendarScreen = Section<{
  monthLabel: string;
  weekdayLabels: string[];
  cells: CalendarCell[];
  selectedDay: AgendaDay;
}>;

export interface WeatherDay {
  name: string;
  dateLabel: string;
  isToday: boolean;
  icon: WeatherIcon;
  maxTemp: number;
  minTemp: number;
  rainProbability: number;
}

export type WeatherScreen = Section<{ city: string; days: WeatherDay[]; hourlyRain: RainForecast }>;

export type HouseScreen = Section<{ summary: string; devices: Device[] }>;

/**
 * Lo que la skill necesita para pintar cada pantalla y actuar sobre la casa. Lo implementan los
 * datos de ejemplo, el servicio del VPS y el cliente de la skill que habla con él.
 * Los fallos de una fuente no lanzan: devuelven el bloque con `status: "error"`.
 */
export interface DashboardData {
  getHome(): Promise<HomeScreen>;
  /** `monthOffset`: 0 es el mes actual, -1 el anterior, 1 el siguiente… */
  getCalendar(monthOffset: number): Promise<CalendarScreen>;
  getWeather(): Promise<WeatherScreen>;
  getHouse(): Promise<HouseScreen>;
  toggleDevice(id: string): Promise<void>;
  turnAllOff(): Promise<void>;
}
