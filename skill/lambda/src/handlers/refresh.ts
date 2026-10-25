import type { RequestHandler } from 'ask-sdk-core';
import { respondWithScreen } from '../apl/respond';
import { isScreenId } from '../apl/screens';
import type { DashboardDataFactory } from '../services/dashboard';
import { isUserEvent, sessionAttributes, userEventArguments } from './util';

/**
 * Refresco periódico que programa cada pantalla (`refresh` con su nombre). Vuelve a pintar la misma
 * pantalla con datos nuevos, sin hablar y conservando el mes y el día que se estaban viendo en Calendario.
 */
export const refreshHandler = (dataFor: DashboardDataFactory): RequestHandler => ({
  canHandle: (handlerInput) => isUserEvent(handlerInput, 'refresh'),
  handle: (handlerInput) => {
    const screen = userEventArguments(handlerInput)?.[1];
    const { calendarOffset, calendarDay } = sessionAttributes(handlerInput);
    return respondWithScreen(handlerInput, dataFor(handlerInput), isScreenId(screen) ? screen : 'inicio', {
      calendarOffset: typeof calendarOffset === 'number' ? calendarOffset : 0,
      calendarDay: typeof calendarDay === 'number' ? calendarDay : undefined,
    });
  },
});
