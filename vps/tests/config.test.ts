import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config';

const key = { VISTAPP_API_KEY: 'k'.repeat(32) };

describe('configuración del VPS', () => {
  it('exige una clave larga', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    expect(() => loadConfig({ VISTAPP_API_KEY: 'corta' })).toThrow(ConfigError);
  });

  it('aplica valores por defecto y deja apagadas las fuentes sin configurar', () => {
    const config = loadConfig(key);
    expect(config).toMatchObject({ host: '127.0.0.1', port: 8787, timeZone: 'Europe/Madrid', workStart: '09:00' });
    expect(config.departure).toEqual({ bufferMinutes: 10, appearMinutes: 30, soonMinutes: 10 });
    expect(config.home).toBeUndefined();
    expect(config.icloud).toBeUndefined();
  });

  it('lee coordenadas, iCloud y calendarios', () => {
    const config = loadConfig({
      ...key,
      VISTAPP_HOME_LAT: '40.4',
      VISTAPP_HOME_LON: '-3.7',
      ICLOUD_USERNAME: 'ejemplo@example.com',
      ICLOUD_APP_PASSWORD: 'aaaa-bbbb-cccc-dddd',
      ICLOUD_CALENDARS: 'Casa, Trabajo',
    });
    expect(config.home).toEqual({ lat: 40.4, lon: -3.7 });
    expect(config.icloud?.calendars).toEqual(['Casa', 'Trabajo']);
  });

  it('rechaza valores incoherentes', () => {
    expect(() => loadConfig({ ...key, VISTAPP_HOME_LAT: '100', VISTAPP_HOME_LON: '0' })).toThrow('coordenadas');
    expect(() => loadConfig({ ...key, VISTAPP_WORK_START: '9h' })).toThrow('HH:mm');
    expect(() => loadConfig({ ...key, VISTAPP_TIMEZONE: 'Marte/Olympus' })).toThrow('zona horaria');
    expect(() => loadConfig({ ...key, VISTAPP_ALERT_APPEAR_MINUTES: '5' })).toThrow('umbrales');
  });
});
