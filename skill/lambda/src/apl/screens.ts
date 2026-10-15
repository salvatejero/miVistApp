import calendario from '../../../apl/calendario.json';
import casa from '../../../apl/casa.json';
import inicio from '../../../apl/inicio.json';
import tiempo from '../../../apl/tiempo.json';
import type { DashboardData } from '../services/dashboard';
import type { AplDocument } from './render';

export const SCREEN_IDS = ['inicio', 'calendario', 'tiempo', 'casa'] as const;
export type ScreenId = (typeof SCREEN_IDS)[number];

export const isScreenId = (value: unknown): value is ScreenId => SCREEN_IDS.includes(value as ScreenId);

export interface ScreenOptions {
  /** Meses desde el actual en la pantalla Calendario. */
  calendarOffset?: number;
}

interface ScreenDefinition {
  document: AplDocument;
  /** Nombre del datasource; coincide con el parámetro de mainTemplate y con el contrato. */
  datasource: string;
  load: (data: DashboardData, options: ScreenOptions) => Promise<unknown>;
}

export const SCREENS: Record<ScreenId, ScreenDefinition> = {
  inicio: { document: inicio, datasource: 'home', load: (data) => data.getHome() },
  calendario: { document: calendario, datasource: 'calendar', load: (data, options) => data.getCalendar(options.calendarOffset ?? 0) },
  tiempo: { document: tiempo, datasource: 'weather', load: (data) => data.getWeather() },
  casa: { document: casa, datasource: 'house', load: (data) => data.getHouse() },
};

export const screenToken = (screen: ScreenId): string => `vistapp-${screen}`;
