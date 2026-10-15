import { SkillBuilders } from 'ask-sdk-core';
import type { Skill } from 'ask-sdk-core';
import {
  errorHandler,
  fallbackHandler,
  helpHandler,
  launchHandler,
  sessionEndedHandler,
  stopHandler,
} from './handlers';
import type { DashboardData } from './services/dashboard';
import { MockDashboardData } from './services/mock';

export function buildSkill(data: DashboardData = new MockDashboardData()): Skill {
  return SkillBuilders.custom()
    .addRequestHandlers(launchHandler(data), helpHandler, stopHandler, fallbackHandler, sessionEndedHandler)
    .addErrorHandlers(errorHandler)
    .withCustomUserAgent('mivistapp/0.1')
    .create();
}
