import type { CalendarScreen, HomeScreen, HouseScreen, WeatherScreen } from '../../contracts';
import type { DashboardData } from '../dashboard';
import calendar from '../../../../../contracts/fixtures/calendar.json';
import home from '../../../../../contracts/fixtures/home.json';
import house from '../../../../../contracts/fixtures/house.json';
import weather from '../../../../../contracts/fixtures/weather.json';

/** Datos de ejemplo de contracts/fixtures. Se sustituirán fuente a fuente en la Fase 3. */
export class MockDashboardData implements DashboardData {
  getHome(): Promise<HomeScreen> {
    return Promise.resolve(structuredClone(home) as HomeScreen);
  }

  getCalendar(): Promise<CalendarScreen> {
    return Promise.resolve(structuredClone(calendar) as CalendarScreen);
  }

  getWeather(): Promise<WeatherScreen> {
    return Promise.resolve(structuredClone(weather) as WeatherScreen);
  }

  getHouse(): Promise<HouseScreen> {
    return Promise.resolve(structuredClone(house) as HouseScreen);
  }
}
