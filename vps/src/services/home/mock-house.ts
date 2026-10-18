import type { Device } from '../../../../contracts/types';
import { deviceStateLabel } from '../../../../lib/labels';
import houseFixture from '../../../../contracts/fixtures/house.json';

export interface HouseSource {
  devices(): Promise<Device[]>;
  toggle(id: string): Promise<void>;
  allOff(): Promise<void>;
}

/** Casa de ejemplo con el estado en memoria, hasta que haya Home Assistant (Fase 3, `datos-casa`). */
export class MockHouse implements HouseSource {
  private readonly state = new Map<string, boolean>();

  devices(): Promise<Device[]> {
    return Promise.resolve(
      (houseFixture.devices as Device[]).map((device) => {
        const on = this.state.get(device.id) ?? device.on;
        return { ...device, on, stateLabel: deviceStateLabel(device.kind, on) };
      }),
    );
  }

  async toggle(id: string): Promise<void> {
    const device = (await this.devices()).find((d) => d.id === id);
    if (device) this.state.set(id, !device.on);
  }

  async allOff(): Promise<void> {
    for (const device of await this.devices()) this.state.set(device.id, false);
  }
}
