import type { HandlerInput } from 'ask-sdk-core';
import type { Response } from 'ask-sdk-model';
import { config } from '../config';
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

/** Más a menudo mientras hay un aviso de salida, para que la cuenta atrás avance. */
const refreshMinutes = (content: unknown): number =>
  (content as { departureAlert?: unknown } | null)?.departureAlert ? config.alertRefreshMinutes : config.refreshMinutes;

/** Espera `ms` o lo que tarde `promise`, lo que ocurra antes. Devuelve null si se acaba el tiempo. */
async function within<T>(promise: Promise<T>, ms: number): Promise<{ value: T } | null> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([promise.then((value) => ({ value })), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export interface RespondOptions extends ScreenOptions {
  speech?: string;
  /**
   * Al abrir o cambiar de pantalla: si los datos tardan, se pinta enseguida lo guardado o el esqueleto
   * y la pantalla pide los datos sola. Los refrescos y los botones de casa esperan a los datos.
   */
  progressive?: boolean;
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
  const loading = load(data, options);

  if (options.progressive) {
    loading.catch(() => undefined); // si se pinta la provisional, el resultado se descarta
    const quick = await within(loading, config.preloadAfterMs);
    if (!quick) {
      const cached = canPreview(data) ? await data.preview(cacheKey(options)) : undefined;
      const content = cached ?? loadingContent(screen, new Date(), config.timeZone);
      const provisional = withLoading(document, screen, config.idleTimeoutMs, cached === undefined);
      return builder.addDirective(renderDocument(token, provisional, { [datasource]: content })).getResponse();
    }
    return builder.addDirective(renderWithData(screen, quick.value)).getResponse();
  }
  return builder.addDirective(renderWithData(screen, await loading)).getResponse();
}

function renderWithData(screen: ScreenId, content: unknown) {
  const { document, datasource } = SCREENS[screen];
  const keepAlive = { screen, refreshMs: refreshMinutes(content) * 60_000, idleTimeoutMs: config.idleTimeoutMs };
  return renderDocument(screenToken(screen), withKeepAlive(document, keepAlive), { [datasource]: content });
}
