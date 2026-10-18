import { describe, expect, it } from 'vitest';
import { departureAlert, departureState, isPhysicalLocation } from '../src/services/traffic/departure-alert';
import { TZ } from './helpers';

const rule = { bufferMinutes: 10, appearMinutes: 30, soonMinutes: 10, timeZone: TZ };
// Evento a las 10:00 (Madrid, verano: 08:00 UTC), 20 min de trayecto → salir a las 09:30.
const event = { id: 'ev', title: 'Revisión', start: new Date('2026-10-15T08:00:00Z'), timeLabel: '10:00', placeLabel: 'Centro de salud' };
const travel = { travelMinutes: 20, trafficLabel: 'Tráfico fluido' };
const at = (hhmmUtc: string) => new Date(`2026-10-15T${hhmmUtc}:00Z`);

describe('aviso de salida', () => {
  it('no aparece con más de 30 min para salir', () => {
    expect(departureAlert(event, travel, at('06:59'), rule)).toBeNull();
  });

  it('aparece justo a 30 min y sigue hasta 11', () => {
    expect(departureAlert(event, travel, at('07:00'), rule)).toMatchObject({ state: 'appear', minutesToLeave: 30, leaveAt: '09:30', arriveAt: '09:50' });
    expect(departureAlert(event, travel, at('07:19'), rule)?.state).toBe('appear');
  });

  it('falta poco desde 10 hasta 1 min', () => {
    expect(departureAlert(event, travel, at('07:20'), rule)).toMatchObject({ state: 'soon', minutesToLeave: 10 });
    expect(departureAlert(event, travel, at('07:29'), rule)).toMatchObject({ state: 'soon', minutesToLeave: 1 });
  });

  it('sal ya a la hora de salir y después, con la llegada si sales ahora', () => {
    expect(departureAlert(event, travel, at('07:30'), rule)).toMatchObject({ state: 'leave_now', minutesToLeave: 0, arriveAt: '09:50' });
    expect(departureAlert(event, travel, at('07:45'), rule)).toMatchObject({ state: 'leave_now', minutesToLeave: 0, arriveAt: '10:05' });
  });

  it('desaparece cuando el evento ha empezado', () => {
    expect(departureAlert(event, travel, at('08:00'), rule)).toBeNull();
  });

  it('se adelanta si el trayecto empeora', () => {
    expect(departureAlert(event, { travelMinutes: 45 }, at('06:40'), rule)).toMatchObject({ state: 'appear', leaveAt: '09:05' });
  });

  it('respeta umbrales configurados', () => {
    expect(departureState(50, { ...rule, appearMinutes: 60, soonMinutes: 20 })).toBe('appear');
    expect(departureState(15, { ...rule, appearMinutes: 60, soonMinutes: 20 })).toBe('soon');
  });

  it('ignora enlaces de reunión y ubicaciones vacías', () => {
    expect(isPhysicalLocation('Centro de salud, Calle Falsa 1')).toBe(true);
    for (const location of ['https://teams.microsoft.com/l/abc', 'Zoom: zoom.us/j/1', 'Google Meet (meet.google.com/abc)', '', '  ', undefined]) {
      expect(isPhysicalLocation(location), String(location)).toBe(false);
    }
  });
});
