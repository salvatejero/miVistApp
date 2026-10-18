import { SkillBuilders } from 'ask-sdk-core';
import type { Skill } from 'ask-sdk-core';
import type { DepartureAlertState } from './contracts';
import {
  errorHandler,
  fallbackHandler,
  helpHandler,
  sessionEndedHandler,
  stopHandler,
  systemErrorHandler,
  unknownEventHandler,
} from './handlers/builtins';
import { calendarMonthHandler } from './handlers/calendar';
import { houseHandler } from './handlers/house';
import { launchHandler } from './handlers/launch';
import { navigationHandler } from './handlers/navigation';
import { refreshHandler } from './handlers/refresh';
import { sessionAttributes } from './handlers/util';
import { config } from './config';
import type { DashboardDataFactory } from './services/dashboard';
import type { MockHouseState } from './services/mock';
import { MockDashboardData } from './services/mock';
import type { CacheStore } from './services/vps/cache-store';
import { DynamoCacheStore, MemoryCacheStore } from './services/vps/cache-store';
import { CachedDashboardData } from './services/vps/cached';
import { VpsClient } from './services/vps/client';

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

/** Datos del VPS con la caché de la skill. Sin tabla de DynamoDB (en local), la caché vive en memoria. */
export function vpsDataFactory(vpsUrl: string, apiKey: string, store?: CacheStore): DashboardDataFactory {
  const cache = store ?? (config.dynamoTable ? DynamoCacheStore.create(config.dynamoTable, config.dynamoRegion) : new MemoryCacheStore());
  const data = new CachedDashboardData(new VpsClient(vpsUrl, apiKey, config.vpsTimeoutMs), cache, config.timeZone);
  return () => data;
}

const defaultFactory = (): DashboardDataFactory =>
  config.vpsUrl && config.apiKey ? vpsDataFactory(config.vpsUrl, config.apiKey) : mockDataFactory;

export function buildSkill(dataFor: DashboardDataFactory = defaultFactory()): Skill {
  return SkillBuilders.custom()
    .addRequestHandlers(
      launchHandler(dataFor),
      navigationHandler(dataFor),
      refreshHandler(dataFor),
      calendarMonthHandler(dataFor),
      houseHandler(dataFor),
      helpHandler,
      stopHandler,
      fallbackHandler,
      unknownEventHandler,
      systemErrorHandler,
      sessionEndedHandler,
    )
    .addErrorHandlers(errorHandler)
    .withCustomUserAgent('mivistapp/0.2')
    .create();
}
