import type { HandlerInput } from 'ask-sdk-core';
import type { Response } from 'ask-sdk-model';
import { config } from '../config';
import type { DashboardData } from '../services/dashboard';
import { renderDocument, supportsApl, withKeepAlive } from './render';
import type { ScreenId, ScreenOptions } from './screens';
import { SCREENS, screenToken } from './screens';

/** Más a menudo mientras hay un aviso de salida, para que la cuenta atrás avance. */
const refreshMinutes = (content: unknown): number =>
  (content as { departureAlert?: unknown } | null)?.departureAlert ? config.alertRefreshMinutes : config.refreshMinutes;

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
  const content = await load(data, options);
  const keepAlive = { screen, refreshMs: refreshMinutes(content) * 60_000, idleTimeoutMs: config.idleTimeoutMs };
  const directive = renderDocument(screenToken(screen), withKeepAlive(document, keepAlive), { [datasource]: content });
  if (options.speech) builder.speak(options.speech);
  return builder.addDirective(directive).getResponse();
}
