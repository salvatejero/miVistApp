import type { HandlerInput } from 'ask-sdk-core';
import { getSupportedInterfaces } from 'ask-sdk-core';
import type { interfaces } from 'ask-sdk-model';
import theme from '../../apl/shared/theme.json';

type AplDocument = Record<string, unknown> & { resources?: unknown[] };

export function supportsApl(handlerInput: HandlerInput): boolean {
  return getSupportedInterfaces(handlerInput.requestEnvelope)['Alexa.Presentation.APL'] !== undefined;
}

/** Añade los recursos compartidos (colores, tamaños por viewport) delante de los propios del documento. */
export function withTheme(document: AplDocument): AplDocument {
  return { ...document, resources: [...theme.resources, ...(document.resources ?? [])] };
}

export function renderDocument(
  token: string,
  document: AplDocument,
  datasources: Record<string, unknown>,
): interfaces.alexa.presentation.apl.RenderDocumentDirective {
  return {
    type: 'Alexa.Presentation.APL.RenderDocument',
    token,
    document: withTheme(document),
    datasources,
  };
}
