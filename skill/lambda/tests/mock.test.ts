import { describe, expect, it } from 'vitest';
import type { DepartureAlertState } from '../src/contracts';
import { MockDashboardData } from '../src/services/mock';
import { contractErrors } from './helpers';

describe('datos de ejemplo', () => {
  const mock = new MockDashboardData();

  it('Inicio, Tiempo y Casa cumplen el contrato', async () => {
    expect(contractErrors('home', await mock.getHome())).toEqual([]);
    expect(contractErrors('weather', await mock.getWeather())).toEqual([]);
    expect(contractErrors('house', await mock.getHouse())).toEqual([]);
  });

  it('el calendario cumple el contrato en cualquier mes', async () => {
    for (let offset = -14; offset <= 14; offset++) {
      expect(contractErrors('calendar', await mock.getCalendar(offset)), `offset ${offset}`).toEqual([]);
    }
  });

  it.each<DepartureAlertState>(['appear', 'soon', 'leave_now'])('Inicio con aviso %s cumple el contrato', async (alert) => {
    const home = await new MockDashboardData({ alert }).getHome();
    expect(home.departureAlert?.state).toBe(alert);
    expect(contractErrors('home', home)).toEqual([]);
  });

  it('Inicio y Casa comparten el estado de los dispositivos', async () => {
    const data = new MockDashboardData({ houseState: {} });
    await data.toggleDevice('cocina');
    const home = await data.getHome();
    const house = await data.getHouse();
    const inHome = home.house.status === 'ok' ? home.house.devices.find((d) => d.id === 'cocina') : undefined;
    const inHouse = house.status === 'ok' ? house.devices.find((d) => d.id === 'cocina') : undefined;
    expect(inHome?.on).toBe(true);
    expect(inHouse?.on).toBe(true);
  });

  it('ignora dispositivos desconocidos', async () => {
    const state = {};
    await new MockDashboardData({ houseState: state }).toggleDevice('no-existe');
    expect(state).toEqual({});
  });
});
