import type { CalendarScreen, HomeScreen, HouseScreen, WeatherScreen } from '../contracts';

/**
 * Lo que la skill necesita para pintar cada pantalla. Los handlers solo hablan con esta
 * interfaz; las fuentes reales (Fase 3) la implementan sin que cambie la UI.
 */
export interface DashboardData {
  getHome(): Promise<HomeScreen>;
  getCalendar(): Promise<CalendarScreen>;
  getWeather(): Promise<WeatherScreen>;
  getHouse(): Promise<HouseScreen>;
}
