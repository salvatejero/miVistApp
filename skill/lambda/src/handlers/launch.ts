import type { RequestHandler } from 'ask-sdk-core';
import { getRequestType } from 'ask-sdk-core';
import { respondWithScreen } from '../apl/respond';
import type { DashboardDataFactory } from '../services/dashboard';
import { isIntent } from './util';

/** "Alexa, abre mi vistapp" y "vuelve al inicio": siempre abre Inicio. */
export const launchHandler = (dataFor: DashboardDataFactory): RequestHandler => ({
  canHandle: (handlerInput) =>
    getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest' ||
    isIntent(handlerInput, 'AMAZON.NavigateHomeIntent'),
  handle: (handlerInput) => respondWithScreen(handlerInput, dataFor(handlerInput), 'inicio', { progressive: true }),
});
