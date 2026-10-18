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
    return respondWithScreen(handlerInput, dataFor(handlerInput), 'calendario', { calendarOffset, progressive: true });
  },
});
