import type { RequestHandler } from 'ask-sdk-core';
import { respondWithScreen } from '../apl/respond';
import { isScreenId } from '../apl/screens';
import type { DashboardDataFactory } from '../services/dashboard';
import { isUserEvent, userEventArguments } from './util';

/**
 * Botones de casa: `house.toggle` con el id del dispositivo y `house.allOff`. El último argumento
 * es la pantalla desde la que se pulsó (Inicio o Casa), que se vuelve a pintar con el estado nuevo.
 */
export const houseHandler = (dataFor: DashboardDataFactory): RequestHandler => ({
  canHandle: (handlerInput) => isUserEvent(handlerInput, 'house.toggle') || isUserEvent(handlerInput, 'house.allOff'),
  handle: async (handlerInput) => {
    const args = userEventArguments(handlerInput) ?? [];
    const data = dataFor(handlerInput);
    let speech: string | undefined;
    try {
      if (args[0] === 'house.toggle' && typeof args[1] === 'string') {
        await data.toggleDevice(args[1]);
      } else if (args[0] === 'house.allOff') {
        await data.turnAllOff();
      }
    } catch (error) {
      console.error('No se pudo actuar sobre la casa:', error instanceof Error ? error.name : 'Error');
      speech = 'No he podido conectar con la casa.';
    }
    const origin = args.at(-1);
    return respondWithScreen(handlerInput, data, isScreenId(origin) ? origin : 'casa', { speech });
  },
});
