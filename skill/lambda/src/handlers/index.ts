import type { ErrorHandler, HandlerInput, RequestHandler } from 'ask-sdk-core';
import { getIntentName, getRequestType } from 'ask-sdk-core';
import type { Response } from 'ask-sdk-model';
import type { DashboardData } from '../services/dashboard';
import { renderHome } from '../screens/home';

const isIntent = (handlerInput: HandlerInput, ...names: string[]): boolean =>
  getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
  names.includes(getIntentName(handlerInput.requestEnvelope));

export function launchHandler(data: DashboardData): RequestHandler {
  return {
    canHandle: (handlerInput) =>
      getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest' ||
      isIntent(handlerInput, 'AMAZON.NavigateHomeIntent'),
    handle: async (handlerInput) => renderHome(handlerInput, await data.getHome()),
  };
}

export const helpHandler: RequestHandler = {
  canHandle: (handlerInput) => isIntent(handlerInput, 'AMAZON.HelpIntent'),
  handle: (handlerInput) =>
    handlerInput.responseBuilder
      .speak('Mi VistApp muestra tu día de un vistazo: la hora, el tiempo, la agenda y el tráfico. Usa el menú de la izquierda para cambiar de pantalla.')
      .reprompt('¿Qué quieres hacer?')
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
      .speak('No te he entendido. Puedes pedir ayuda o usar el menú de la pantalla.')
      .reprompt('¿Qué quieres hacer?')
      .getResponse(),
};

export const sessionEndedHandler: RequestHandler = {
  canHandle: (handlerInput) => getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest',
  handle: (handlerInput): Response => handlerInput.responseBuilder.getResponse(),
};

export const errorHandler: ErrorHandler = {
  canHandle: () => true,
  handle: (handlerInput, error) => {
    // Solo el tipo de petición y el nombre del error: el sobre de la petición lleva datos del usuario.
    console.error('Error en', getRequestType(handlerInput.requestEnvelope), error.name, error.message);
    return handlerInput.responseBuilder
      .speak('Lo siento, algo ha fallado. Inténtalo de nuevo en un momento.')
      .getResponse();
  },
};
