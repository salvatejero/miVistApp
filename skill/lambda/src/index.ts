import './node16';
import type { RequestEnvelope, ResponseEnvelope } from 'ask-sdk-model';
import { buildSkill } from './skill';

const skill = buildSkill();

/** Punto de entrada de la Lambda (Alexa-hosted). */
export const handler = (event: RequestEnvelope, context: unknown): Promise<ResponseEnvelope> =>
  skill.invoke(event, context);
