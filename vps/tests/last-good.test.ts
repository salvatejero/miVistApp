import { describe, expect, it, vi } from 'vitest';
import { LastGood } from '../src/last-good';

describe('último dato bueno', () => {
  it('no repite la consulta mientras el dato es reciente', async () => {
    let now = 0;
    const cache = new LastGood<number>(1000, () => now);
    const load = vi.fn().mockResolvedValue(1);
    await cache.get('k', load);
    now = 999;
    expect(await cache.get('k', load)).toEqual({ value: 1 });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('sirve el último dato marcado si la fuente falla', async () => {
    let now = 0;
    const cache = new LastGood<number>(1000, () => now);
    await cache.get('k', () => Promise.resolve(1));
    now = 5000;
    expect(await cache.get('k', () => Promise.reject(new Error('caída')))).toEqual({ value: 1, staleSince: new Date(0) });
  });

  it('propaga el error si nunca hubo dato', async () => {
    const cache = new LastGood<number>(1000);
    await expect(cache.get('k', () => Promise.reject(new Error('caída')))).rejects.toThrow('caída');
  });

  it('comparte una consulta en marcha', async () => {
    const cache = new LastGood<number>(1000);
    const load = vi.fn().mockResolvedValue(2);
    await Promise.all([cache.get('k', load), cache.get('k', load)]);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
