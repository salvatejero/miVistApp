import type {
  CalendarScreen,
  DepartureAlert,
  DepartureAlertState,
  Device,
  HomeScreen,
  HouseScreen,
  WeatherScreen,
} from '../../contracts';
import type { DashboardData } from '../dashboard';
import { deviceStateLabel, houseSummary, monthLabel, MONTHS, shortDateLabel, WEEKDAYS_SHORT } from '../shared/labels';
import type { CivilDate } from '../shared/month-grid';
import { addMonths, buildMonthGrid } from '../shared/month-grid';
import alertAppear from '../../../../../contracts/fixtures/departure-alert-appear.json';
import alertLeaveNow from '../../../../../contracts/fixtures/departure-alert-leave-now.json';
import alertSoon from '../../../../../contracts/fixtures/departure-alert-soon.json';
import calendarFixture from '../../../../../contracts/fixtures/calendar.json';
import homeFixture from '../../../../../contracts/fixtures/home.json';
import houseFixture from '../../../../../contracts/fixtures/house.json';
import weatherFixture from '../../../../../contracts/fixtures/weather.json';

/** Fecha de los fixtures: los datos de ejemplo son siempre del jueves 15 de octubre de 2026. */
const FIXTURE_TODAY: CivilDate = { year: 2026, month: 10, day: 15 };

const ALERTS: Record<DepartureAlertState, DepartureAlert> = {
  appear: alertAppear as DepartureAlert,
  soon: alertSoon as DepartureAlert,
  leave_now: alertLeaveNow as DepartureAlert,
};

/** Estado de los dispositivos de ejemplo, guardado en los atributos de sesión: `{ [id]: encendido }`. */
export type MockHouseState = Record<string, boolean>;

export interface MockOptions {
  /** Dónde se guarda el estado de la casa entre peticiones de la misma sesión. */
  houseState?: MockHouseState;
  /** Estado del aviso de salida que se muestra en Inicio; sin él, no hay aviso. */
  alert?: DepartureAlertState;
}

const clone = <T>(value: unknown): T => structuredClone(value) as T;

/** Datos de ejemplo de contracts/fixtures. Se sustituirán fuente a fuente en la Fase 3. */
export class MockDashboardData implements DashboardData {
  private readonly houseState: MockHouseState;
  private readonly alert: DepartureAlertState | undefined;

  constructor(options: MockOptions = {}) {
    this.houseState = options.houseState ?? {};
    this.alert = options.alert;
  }

  getHome(): Promise<HomeScreen> {
    const home = clone<HomeScreen>(homeFixture);
    if (home.house.status === 'ok') {
      const devices = this.devices();
      home.house.devices = home.house.devices.map((device) => devices.find((d) => d.id === device.id) ?? device);
    }
    home.departureAlert = this.alert ? clone<DepartureAlert>(ALERTS[this.alert]) : null;
    return Promise.resolve(home);
  }

  getCalendar(monthOffset: number): Promise<CalendarScreen> {
    if (monthOffset === 0) return Promise.resolve(clone<CalendarScreen>(calendarFixture));
    const { year, month } = addMonths(FIXTURE_TODAY.year, FIXTURE_TODAY.month, monthOffset);
    return Promise.resolve({
      status: 'ok',
      monthLabel: monthLabel(year, month),
      weekdayLabels: [...WEEKDAYS_SHORT],
      cells: buildMonthGrid(year, month, FIXTURE_TODAY, new Set()),
      selectedDay: { title: `1 ${MONTHS[month - 1]?.slice(0, 3)}`, dateLabel: shortDateLabel(year, month, 1), items: [] },
    });
  }

  getWeather(): Promise<WeatherScreen> {
    return Promise.resolve(clone<WeatherScreen>(weatherFixture));
  }

  getHouse(): Promise<HouseScreen> {
    const devices = this.devices();
    return Promise.resolve({ status: 'ok', summary: houseSummary(devices), devices });
  }

  toggleDevice(id: string): Promise<void> {
    const device = this.devices().find((d) => d.id === id);
    if (device) this.houseState[id] = !device.on;
    return Promise.resolve();
  }

  turnAllOff(): Promise<void> {
    for (const device of this.devices()) this.houseState[device.id] = false;
    return Promise.resolve();
  }

  private devices(): Device[] {
    const house = clone<HouseScreen>(houseFixture);
    if (house.status !== 'ok') return [];
    return house.devices.map((device) => {
      const on = this.houseState[device.id] ?? device.on;
      return { ...device, on, stateLabel: deviceStateLabel(device.kind, on) };
    });
  }
}
