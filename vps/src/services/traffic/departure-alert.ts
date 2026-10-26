import type { DepartureAlert, DepartureAlertState } from '../../../../contracts/types';
import { addMinutes, hhmm, minutesBetween } from '../../../../lib/time';

export interface DepartureRule {
  bufferMinutes: number;
  appearMinutes: number;
  soonMinutes: number;
  timeZone: string;
}

export interface UpcomingEvent {
  id: string;
  title: string;
  start: Date;
  timeLabel: string;
  placeLabel: string;
}

const MEETING_LINK =
  /(https?:\/\/|www\.|\bteams\b|\bzoom\b|\bmeet\b|\bwebex\b|\bskype\b|facetime|videollamada|llamada|\bonline\b|\bvirtual\b|\bremot[oa]\b)/i;

/** Ubicación física (no vacía y no un enlace de reunión). La geocodificación decide después si existe. */
export const isPhysicalLocation = (location: string | undefined): location is string =>
  !!location && location.trim().length > 2 && !MEETING_LINK.test(location);

/** Hora de salir = inicio − trayecto con tráfico − colchón. */
export const leaveTime = (start: Date, travelMinutes: number, bufferMinutes: number): Date =>
  addMinutes(start, -(travelMinutes + bufferMinutes));

/**
 * Estado del aviso según los minutos que faltan para salir:
 * más de `appear` → oculto; (soon, appear] → aparece; (0, soon] → falta poco; ≤ 0 → sal ya.
 * Si el evento ya ha empezado, no hay aviso.
 */
export function departureState(minutesToLeave: number, rule: DepartureRule): DepartureAlertState | null {
  if (minutesToLeave > rule.appearMinutes) return null;
  if (minutesToLeave > rule.soonMinutes) return 'appear';
  if (minutesToLeave > 0) return 'soon';
  return 'leave_now';
}

/** Aviso de salida para un evento con su trayecto, o null si no toca mostrarlo. Función pura. */
export function departureAlert(
  event: UpcomingEvent,
  travel: { travelMinutes: number; trafficLabel?: string; estimatedAt?: Date },
  now: Date,
  rule: DepartureRule,
): DepartureAlert | null {
  if (now >= event.start) return null;
  const leaveAt = leaveTime(event.start, travel.travelMinutes, rule.bufferMinutes);
  const minutesToLeave = minutesBetween(now, leaveAt);
  const state = departureState(minutesToLeave, rule);
  if (!state) return null;
  // Saliendo ahora (sal ya) se llega a ahora + trayecto; si no, a la hora prevista.
  const arrival = state === 'leave_now' ? addMinutes(now, travel.travelMinutes) : addMinutes(leaveAt, travel.travelMinutes);
  return {
    eventId: event.id,
    state,
    eventTimeLabel: event.timeLabel,
    title: event.title,
    placeLabel: event.placeLabel,
    travelMinutes: travel.travelMinutes,
    ...(travel.trafficLabel ? { trafficLabel: travel.trafficLabel } : {}),
    leaveAt: hhmm(leaveAt, rule.timeZone),
    minutesToLeave: Math.max(0, minutesToLeave),
    arriveAt: hhmm(arrival, rule.timeZone),
    ...(travel.estimatedAt ? { estimatedAt: hhmm(travel.estimatedAt, rule.timeZone) } : {}),
  };
}
