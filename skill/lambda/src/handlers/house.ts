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
    if (args[0] === 'house.toggle' && typeof args[1] === 'string') {
      await data.toggleDevice(args[1]);
    } else if (args[0] === 'house.allOff') {
      await data.turnAllOff();
    }
    const origin = args.at(-1);
    return respondWithScreen(handlerInput, data, isScreenId(origin) ? origin : 'casa');
  },
});
