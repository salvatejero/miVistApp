import type { RequestHandler } from 'ask-sdk-core';
import { respondWithScreen } from '../apl/respond';
import type { DashboardDataFactory } from '../services/dashboard';
import { isUserEvent, sessionAttributes, userEventArguments } from './util';

/** Botones del calendario: `calendar.month` con -1 (anterior), 0 (hoy) o 1 (siguiente). */
export const calendarMonthHandler = (dataFor: DashboardDataFactory): RequestHandler => ({
  canHandle: (handlerInput) => isUserEvent(handlerInput, 'calendar.month'),
  handle: (handlerInput) => {
    const step = Number(userEventArguments(handlerInput)?.[1]);
    const attributes = sessionAttributes(handlerInput);
    const current = typeof attributes.calendarOffset === 'number' ? attributes.calendarOffset : 0;
    const calendarOffset = step === 0 || !Number.isFinite(step) ? 0 : current + Math.sign(step);
    attributes.calendarOffset = calendarOffset;
    delete attributes.calendarDay;
    return respondWithScreen(handlerInput, dataFor(handlerInput), 'calendario', { calendarOffset, progressive: true });
  },
});

/** Día pulsado en la malla del mes (`calendar.day` con el número de día): el panel lateral muestra sus eventos. */
export const calendarDayHandler = (dataFor: DashboardDataFactory): RequestHandler => ({
  canHandle: (handlerInput) => isUserEvent(handlerInput, 'calendar.day'),
  handle: (handlerInput) => {
    const day = Number(userEventArguments(handlerInput)?.[1]);
    const attributes = sessionAttributes(handlerInput);
    const calendarOffset = typeof attributes.calendarOffset === 'number' ? attributes.calendarOffset : 0;
    const calendarDay = Number.isInteger(day) && day >= 1 && day <= 31 ? day : undefined;
    if (calendarDay === undefined) delete attributes.calendarDay;
    else attributes.calendarDay = calendarDay;
    return respondWithScreen(handlerInput, dataFor(handlerInput), 'calendario', { calendarOffset, calendarDay, progressive: true });
  },
});
