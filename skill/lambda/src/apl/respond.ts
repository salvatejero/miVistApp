import type { HandlerInput } from 'ask-sdk-core';
import type { Response } from 'ask-sdk-model';
import { within } from '../../../../lib/time';
import { config } from '../config';
import type { HomeScreen } from '../contracts';
import type { DashboardData } from '../services/dashboard';
import { loadingContent } from './loading';
import { renderDocument, supportsApl, withKeepAlive, withLoading } from './render';
import type { ScreenId, ScreenOptions } from './screens';
import { SCREENS, screenToken } from './screens';

export const NO_SCREEN_SPEECH = 'Mi VistApp necesita un dispositivo con pantalla, como un Echo Show.';

/** Fuente que además sabe dar enseguida lo último guardado de una pantalla (ver CachedDashboardData). */
export interface Previewable {
  preview(key: string): Promise<unknown>;
}

const canPreview = (data: DashboardData): data is DashboardData & Previewable =>
  typeof (data as Partial<Previewable>).preview === 'function';

/**
 * Cada minuto mientras hay un aviso de salida (la cuenta atrás tiene que moverse) o un evento de hoy
 * con salida calculada (para que el aviso aparezca a su hora y no hasta 5 min tarde).
 */
function refreshMinutes(content: unknown): number {
  const home = content as Partial<HomeScreen> | null;
  const upcoming = home?.agenda?.status === 'ok' && home.agenda.today.items.some((item) => item.departure);
  return home?.departureAlert || upcoming ? config.alertRefreshMinutes : config.refreshMinutes;
}

export interface RespondOptions extends ScreenOptions {
  speech?: string;
  /**
   * Al abrir o cambiar de pantalla: si los datos tardan, se pinta enseguida lo guardado o el esqueleto
   * y la pantalla pide los datos sola. Los refrescos y los botones de casa esperan a los datos.
   */
  progressive?: boolean;
  /** No pedir datos ahora (el VPS acaba de fallar): pintar lo guardado o el esqueleto y que la pantalla los pida. */
  offline?: boolean;
}

/** Pinta una pantalla con sus datos. La sesión queda abierta para seguir navegando. */
export async function respondWithScreen(
  handlerInput: HandlerInput,
  data: DashboardData,
  screen: ScreenId,
  options: RespondOptions = {},
): Promise<Response> {
  const builder = handlerInput.responseBuilder;
  if (!supportsApl(handlerInput)) {
    return builder.speak(NO_SCREEN_SPEECH).withShouldEndSession(true).getResponse();
  }
  if (options.speech) builder.speak(options.speech);
  const { document, datasource, load, cacheKey } = SCREENS[screen];
  const token = screenToken(screen);
  if (options.progressive) {
    const loading = options.offline ? null : load(data, options);
    loading?.catch(() => undefined); // si se pinta la provisional, el resultado se descarta
    const quick = loading ? await within(loading, config.preloadAfterMs) : null;
    if (!quick) {
      const cached = canPreview(data) ? await data.preview(cacheKey(options)) : undefined;
      const content = cached ?? loadingContent(screen, new Date(), config.timeZone);
      const provisional = withLoading(document, screen, config.idleTimeoutMs, cached === undefined);
      return builder.addDirective(renderDocument(token, provisional, { [datasource]: content })).getResponse();
    }
    return builder.addDirective(renderWithData(screen, quick.value)).getResponse();
  }
  return builder.addDirective(renderWithData(screen, await load(data, options))).getResponse();
}

function renderWithData(screen: ScreenId, content: unknown) {
  const { document, datasource } = SCREENS[screen];
  const keepAlive = { screen, refreshMs: refreshMinutes(content) * 60_000, idleTimeoutMs: config.idleTimeoutMs };
  return renderDocument(screenToken(screen), withKeepAlive(document, keepAlive), { [datasource]: content });
}
