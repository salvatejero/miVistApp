import type { HandlerInput } from 'ask-sdk-core';
import type { CalendarScreen, HomeScreen, HouseScreen, WeatherScreen } from '../contracts';

/**
 * Lo que la skill necesita para pintar cada pantalla y actuar sobre la casa. Los handlers solo
 * hablan con esta interfaz; las fuentes reales (Fase 3) la implementan sin que cambie la UI.
 * Ningún método lanza por un fallo de la fuente: devuelve el bloque con `status: "error"`.
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

/** Crea las fuentes de datos para una petición (cada usuario tiene las suyas). */
export type DashboardDataFactory = (handlerInput: HandlerInput) => DashboardData;
