import type { ErrorHandler, RequestHandler } from 'ask-sdk-core';
import { getRequestType } from 'ask-sdk-core';
import { isIntent, userEventArguments } from './util';

export const helpHandler: RequestHandler = {
  canHandle: (handlerInput) => isIntent(handlerInput, 'AMAZON.HelpIntent'),
  handle: (handlerInput) =>
    handlerInput.responseBuilder
      .speak('Mi VistApp muestra tu día de un vistazo. Toca el menú de la izquierda o pídeme el calendario, el tiempo o la casa.')
      .reprompt('¿Qué quieres ver?')
      .getResponse(),
};

export const stopHandler: RequestHandler = {
  canHandle: (handlerInput) => isIntent(handlerInput, 'AMAZON.CancelIntent', 'AMAZON.StopIntent'),
  handle: (handlerInput) => handlerInput.responseBuilder.speak('Hasta luego.').withShouldEndSession(true).getResponse(),
};

export const fallbackHandler: RequestHandler = {
  canHandle: (handlerInput) => isIntent(handlerInput, 'AMAZON.FallbackIntent'),
  handle: (handlerInput) =>
    handlerInput.responseBuilder
      .speak('No te he entendido. Puedes pedirme el calendario, el tiempo o la casa.')
      .reprompt('¿Qué quieres ver?')
      .getResponse(),
};

/** Evento de pantalla que no reconocemos: no se hace nada y la pantalla sigue como está. */
export const unknownEventHandler: RequestHandler = {
  canHandle: (handlerInput) => userEventArguments(handlerInput) !== null,
  handle: (handlerInput) => handlerInput.responseBuilder.getResponse(),
};

export const sessionEndedHandler: RequestHandler = {
  canHandle: (handlerInput) => getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest',
  handle: (handlerInput) => handlerInput.responseBuilder.getResponse(),
};

export const errorHandler: ErrorHandler = {
  canHandle: () => true,
  handle: (handlerInput, error) => {
    // Solo el tipo de petición y el error: el sobre de la petición lleva datos del usuario.
    console.error('Error en', getRequestType(handlerInput.requestEnvelope), error.name, error.message);
    return handlerInput.responseBuilder.speak('Lo siento, algo ha fallado. Inténtalo de nuevo en un momento.').getResponse();
  },
};
