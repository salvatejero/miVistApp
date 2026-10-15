import type { HandlerInput } from 'ask-sdk-core';
import { getIntentName, getRequestType } from 'ask-sdk-core';

export const isIntent = (handlerInput: HandlerInput, ...names: string[]): boolean =>
  getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
  names.includes(getIntentName(handlerInput.requestEnvelope));

/** Argumentos de un SendEvent de APL, o null si la petición no es un evento de usuario. */
export function userEventArguments(handlerInput: HandlerInput): unknown[] | null {
  const request = handlerInput.requestEnvelope.request;
  if (request.type !== 'Alexa.Presentation.APL.UserEvent') return null;
  return Array.isArray(request.arguments) ? request.arguments : [];
}

export const isUserEvent = (handlerInput: HandlerInput, name: string): boolean =>
  userEventArguments(handlerInput)?.[0] === name;

export function sessionAttributes(handlerInput: HandlerInput): Record<string, unknown> {
  return handlerInput.attributesManager.getSessionAttributes();
}
