import type { HandlerInput, RequestHandler } from 'ask-sdk-core';
import { getSlot } from 'ask-sdk-core';
import { respondWithScreen } from '../apl/respond';
import type { ScreenId } from '../apl/screens';
import { isScreenId } from '../apl/screens';
import type { DashboardDataFactory } from '../services/dashboard';
import { isIntent, isUserEvent, sessionAttributes, userEventArguments } from './util';

/** Pantalla pedida por voz: el id del valor del tipo PANTALLA que Alexa ha reconocido. */
function requestedScreen(handlerInput: HandlerInput): ScreenId | null {
  const args = userEventArguments(handlerInput);
  if (args) return isScreenId(args[1]) ? args[1] : null;
  const slot = getSlot(handlerInput.requestEnvelope, 'pantalla');
  const id = slot?.resolutions?.resolutionsPerAuthority?.find((r) => r.status.code === 'ER_SUCCESS_MATCH')?.values[0]?.value.id;
  return isScreenId(id) ? id : null;
}

/** Menú lateral (evento `navigate`) y "muéstrame el calendario" (ShowScreenIntent). */
export const navigationHandler = (dataFor: DashboardDataFactory): RequestHandler => ({
  canHandle: (handlerInput) => isUserEvent(handlerInput, 'navigate') || isIntent(handlerInput, 'ShowScreenIntent'),
  handle: (handlerInput) => {
    const screen = requestedScreen(handlerInput);
    if (!screen) {
      return handlerInput.responseBuilder
        .speak('Puedo mostrarte el inicio, el calendario, el tiempo o la casa.')
        .reprompt('¿Qué pantalla quieres ver?')
        .getResponse();
    }
    if (screen === 'calendario') sessionAttributes(handlerInput).calendarOffset = 0;
    return respondWithScreen(handlerInput, dataFor(handlerInput), screen, { progressive: true });
  },
});
