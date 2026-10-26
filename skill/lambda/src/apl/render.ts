import type { HandlerInput } from 'ask-sdk-core';
import { getSupportedInterfaces } from 'ask-sdk-core';
import type { interfaces } from 'ask-sdk-model';
import graphics from '../../../apl/shared/graphics.json';
import layouts from '../../../apl/shared/layouts.json';
import styles from '../../../apl/shared/styles.json';
import theme from '../../../apl/shared/theme.json';

export type AplDocument = Record<string, unknown> & { resources?: unknown[] };

const dp = (values: Record<string, number>, scale = 1): Record<string, string> =>
  Object.fromEntries(Object.entries(values).map(([name, value]) => [name, `${Math.round(value * scale)}dp`]));

/** Recursos del tema: medidas a 1280x800 y, en pantallas de 1920 dp o más (Echo Show 15), las mismas escaladas. */
export const themeResources = [
  { description: 'Colores y medidas a 1280x800', colors: theme.colors, strings: theme.strings, dimensions: dp(theme.dimensions) },
  { description: 'Medidas para Echo Show 15', when: '${viewport.width >= 1920}', dimensions: dp(theme.dimensions, theme.xlScale) },
];

export function supportsApl(handlerInput: HandlerInput): boolean {
  return getSupportedInterfaces(handlerInput.requestEnvelope)['Alexa.Presentation.APL'] !== undefined;
}

/** Une el paquete compartido (tema, estilos, iconos y componentes) con el documento de una pantalla. */
export function withShared(document: AplDocument): AplDocument {
  return {
    ...document,
    resources: [...themeResources, ...(document.resources ?? [])],
    styles: { ...styles.styles, ...(document.styles as object | undefined) },
    graphics: { ...graphics.graphics, ...(document.graphics as object | undefined) },
    layouts: { ...layouts.layouts, ...(document.layouts as object | undefined) },
  };
}

export interface KeepAlive {
  /** Pantalla que se vuelve a pedir al refrescar. */
  screen: string;
  refreshMs: number;
  idleTimeoutMs: number;
}

/** Evento `refresh` cada `ms` mientras el documento esté en pantalla (APL `handleTick`). */
const tick = (screen: string, ms: number) => [{ minimumDelay: ms, commands: [{ type: 'SendEvent', arguments: ['refresh', screen] }] }];

/**
 * Mantiene la pantalla viva: pide al Echo Show una inactividad larga y, mientras el documento esté en
 * pantalla, manda `refresh` cada `refreshMs`; el backend contesta pintando la misma pantalla con datos
 * nuevos. Como el tick es del documento, si una respuesta se pierde o falla, el siguiente vuelve a intentarlo.
 */
export function withKeepAlive(document: AplDocument, { screen, refreshMs, idleTimeoutMs }: KeepAlive): AplDocument {
  return {
    ...document,
    settings: { ...(document.settings as object | undefined), idleTimeout: idleTimeoutMs },
    handleTick: tick(screen, refreshMs),
  };
}

/** Si la carga que pide una pantalla provisional se pierde, se reintenta cada minuto. */
const PROVISIONAL_RETRY_MS = 60_000;

/**
 * Pantalla provisional (precargada o en esqueleto): al montarse pide enseguida los datos (`refresh`)
 * y, si es esqueleto, hace latir el contenido mientras tanto.
 */
export function withLoading(document: AplDocument, screen: string, idleTimeoutMs: number, pulse: boolean): AplDocument {
  const load = { type: 'SendEvent', arguments: ['refresh', screen] };
  const beat = {
    type: 'AnimateItem',
    componentId: 'contenido',
    duration: 900,
    repeatCount: 200,
    repeatMode: 'reverse',
    value: [{ property: 'opacity', from: 1, to: 0.55 }],
  };
  return {
    ...document,
    settings: { ...(document.settings as object | undefined), idleTimeout: idleTimeoutMs },
    onMount: pulse ? [{ type: 'Parallel', commands: [load, beat] }] : [load],
    handleTick: tick(screen, PROVISIONAL_RETRY_MS),
  };
}

export function renderDocument(
  token: string,
  document: AplDocument,
  datasources: Record<string, unknown>,
): interfaces.alexa.presentation.apl.RenderDocumentDirective {
  return {
    type: 'Alexa.Presentation.APL.RenderDocument',
    token,
    document: withShared(document),
    datasources,
  };
}
