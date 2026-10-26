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
  /** Día del mes pulsado en Calendario; sin él, hoy (o el día 1 en otros meses). */
  calendarDay?: number;
}

interface ScreenDefinition {
  document: AplDocument;
  /** Nombre del datasource; coincide con el parámetro de mainTemplate y con el contrato. */
  datasource: string;
  load: (data: DashboardData, options: ScreenOptions) => Promise<unknown>;
  /** Clave de la última respuesta guardada para esta pantalla. */
  cacheKey: (options: ScreenOptions) => string;
}

export const SCREENS: Record<ScreenId, ScreenDefinition> = {
  inicio: { document: inicio, datasource: 'home', load: (data) => data.getHome(), cacheKey: () => 'home' },
  calendario: {
    document: calendario,
    datasource: 'calendar',
    load: (data, options) => data.getCalendar(options.calendarOffset ?? 0, options.calendarDay),
    cacheKey: (options) =>
      options.calendarDay === undefined ? `calendar:${options.calendarOffset ?? 0}` : `calendar:${options.calendarOffset ?? 0}:${options.calendarDay}`,
  },
  tiempo: { document: tiempo, datasource: 'weather', load: (data) => data.getWeather(), cacheKey: () => 'weather' },
  casa: { document: casa, datasource: 'house', load: (data) => data.getHouse(), cacheKey: () => 'house' },
};

export const screenToken = (screen: ScreenId): string => `vistapp-${screen}`;
