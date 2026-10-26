import { describe, expect, it } from 'vitest';
// @ts-expect-error módulo JavaScript de scripts/
import { mergeManifest } from '../../../scripts/hosted-manifest.mjs';
import ours from '../../skill-package/skill.json';

const hosted = {
  manifest: {
    manifestVersion: '1.0',
    apis: {
      custom: {
        endpoint: { uri: 'arn:aws:lambda:eu-west-1:000000000000:function:ejemplo' },
        regions: { EU: { endpoint: { uri: 'arn:aws:lambda:eu-west-1:000000000000:function:ejemplo' } } },
      },
    },
    publishingInformation: { locales: { 'es-ES': { name: 'Nombre viejo' } } },
    privacyAndCompliance: { allowsPurchases: false },
  },
};

describe('despliegue en Alexa-hosted', () => {
  it('conserva el endpoint de la Lambda de Alexa-hosted y toma el resto del repo', () => {
    const merged = mergeManifest(ours, hosted);
    expect(merged.manifest.apis.custom.endpoint).toEqual(hosted.manifest.apis.custom.endpoint);
    expect(merged.manifest.apis.custom.regions).toEqual(hosted.manifest.apis.custom.regions);
    expect(merged.manifest.apis.custom.interfaces).toEqual(ours.manifest.apis.custom.interfaces);
    expect(merged.manifest.publishingInformation.locales['es-ES'].name).toBe('Mi VistApp');
    expect(merged.manifest.privacyAndCompliance).toEqual({ allowsPurchases: false });
  });

  it('no modifica el manifiesto del repo', () => {
    const before = JSON.stringify(ours);
    mergeManifest(ours, hosted);
    expect(JSON.stringify(ours)).toBe(before);
  });
});
