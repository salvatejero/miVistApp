import type { HandlerInput } from 'ask-sdk-core';
import type { Response } from 'ask-sdk-model';
import inicio from '../../../apl/inicio.json';
import type { HomeScreen } from '../contracts';
import { renderDocument, supportsApl } from '../apl';

export const HOME_TOKEN = 'vistapp-inicio';

export function renderHome(handlerInput: HandlerInput, home: HomeScreen): Response {
  const builder = handlerInput.responseBuilder;
  if (!supportsApl(handlerInput)) {
    return builder
      .speak('Mi VistApp necesita un dispositivo con pantalla, como un Echo Show.')
      .withShouldEndSession(true)
      .getResponse();
  }
  return builder
    .speak('Aquí tienes tu panel.')
    .addDirective(renderDocument(HOME_TOKEN, inicio, { home }))
    .getResponse();
}
