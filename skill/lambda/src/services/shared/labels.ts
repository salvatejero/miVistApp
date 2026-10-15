import type { Device } from '../../contracts';

export const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const WEEKDAYS_LONG = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** Octubre 2026 */
export const monthLabel = (year: number, month: number): string => `${capitalize(MONTHS[month - 1] ?? '')} ${year}`;

/** Día de la semana empezando en lunes (0) para una fecha del calendario civil. */
export const weekdayIndex = (year: number, month: number, day: number): number =>
  (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;

/** Jue 15 oct */
export const shortDateLabel = (year: number, month: number, day: number): string =>
  `${WEEKDAYS_SHORT[weekdayIndex(year, month, day)]} ${day} ${MONTHS[month - 1]?.slice(0, 3)}`;

export const deviceStateLabel = (kind: Device['kind'], on: boolean): string => {
  if (kind === 'blind') return on ? 'Abierta' : 'Cerrada';
  return on ? 'Encendido' : 'Apagado';
};

/** 3 de 8 encendidos */
export const houseSummary = (devices: Device[]): string =>
  `${devices.filter((device) => device.on).length} de ${devices.length} encendidos`;
