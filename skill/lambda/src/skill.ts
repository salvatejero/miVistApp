import { SkillBuilders } from 'ask-sdk-core';
import type { Skill } from 'ask-sdk-core';
import type { DepartureAlertState } from './contracts';
import {
  errorHandler,
  fallbackHandler,
  helpHandler,
  sessionEndedHandler,
  stopHandler,
  unknownEventHandler,
} from './handlers/builtins';
import { calendarMonthHandler } from './handlers/calendar';
import { houseHandler } from './handlers/house';
import { launchHandler } from './handlers/launch';
import { navigationHandler } from './handlers/navigation';
import { sessionAttributes } from './handlers/util';
import type { DashboardDataFactory } from './services/dashboard';
import type { MockHouseState } from './services/mock';
import { MockDashboardData } from './services/mock';

const MOCK_ALERTS: readonly string[] = ['appear', 'soon', 'leave_now'];

/** Datos de ejemplo. VISTAPP_MOCK_ALERT=appear|soon|leave_now muestra el aviso de salida en Inicio. */
export const mockDataFactory: DashboardDataFactory = (handlerInput) => {
  const attributes = sessionAttributes(handlerInput);
  attributes.mockHouse ??= {};
  const alert = process.env.VISTAPP_MOCK_ALERT;
  return new MockDashboardData({
    houseState: attributes.mockHouse as MockHouseState,
    alert: alert && MOCK_ALERTS.includes(alert) ? (alert as DepartureAlertState) : undefined,
  });
};

export function buildSkill(dataFor: DashboardDataFactory = mockDataFactory): Skill {
  return SkillBuilders.custom()
    .addRequestHandlers(
      launchHandler(dataFor),
      navigationHandler(dataFor),
      calendarMonthHandler(dataFor),
      houseHandler(dataFor),
      helpHandler,
      stopHandler,
      fallbackHandler,
      unknownEventHandler,
      sessionEndedHandler,
    )
    .addErrorHandlers(errorHandler)
    .withCustomUserAgent('mivistapp/0.2')
    .create();
}
