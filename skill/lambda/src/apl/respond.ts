import type { HandlerInput } from 'ask-sdk-core';
import type { Response } from 'ask-sdk-model';
import type { DashboardData } from '../services/dashboard';
import { renderDocument, supportsApl } from './render';
import type { ScreenId, ScreenOptions } from './screens';
import { SCREENS, screenToken } from './screens';

export const NO_SCREEN_SPEECH = 'Mi VistApp necesita un dispositivo con pantalla, como un Echo Show.';

/** Pinta una pantalla con sus datos. La sesión queda abierta para seguir navegando. */
export async function respondWithScreen(
  handlerInput: HandlerInput,
  data: DashboardData,
  screen: ScreenId,
  options: ScreenOptions & { speech?: string } = {},
): Promise<Response> {
  const builder = handlerInput.responseBuilder;
  if (!supportsApl(handlerInput)) {
    return builder.speak(NO_SCREEN_SPEECH).withShouldEndSession(true).getResponse();
  }
  const { document, datasource, load } = SCREENS[screen];
  const directive = renderDocument(screenToken(screen), document, { [datasource]: await load(data, options) });
  if (options.speech) builder.speak(options.speech);
  return builder.addDirective(directive).getResponse();
}
