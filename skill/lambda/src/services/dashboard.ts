import type { HandlerInput } from 'ask-sdk-core';
import type { DashboardData } from '../contracts';

export type { DashboardData };

/** Crea las fuentes de datos para una petición. */
export type DashboardDataFactory = (handlerInput: HandlerInput) => DashboardData;
