import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contractErrors, contractsDir, readJson } from './helpers';

/** Qué esquema valida cada fixture, por prefijo del nombre del fichero. */
const schemaForFixture = (file: string): string => {
  const prefixes = ['departure-alert', 'home', 'calendar', 'weather', 'house'];
  const prefix = prefixes.find((p) => file.startsWith(p));
  if (!prefix) throw new Error(`Fixture sin esquema: ${file}`);
  return prefix;
};

describe('contrato de datos', () => {
  const fixtures = readdirSync(join(contractsDir, 'fixtures')).filter((f) => f.endsWith('.json'));

  it.each(fixtures)('%s cumple su esquema', (file) => {
    expect(contractErrors(schemaForFixture(file), readJson(join(contractsDir, 'fixtures', file)))).toEqual([]);
  });

  it('hay un fixture para cada estado del aviso de salida', () => {
    const states = fixtures
      .filter((f) => f.startsWith('departure-alert'))
      .map((f) => (readJson(join(contractsDir, 'fixtures', f)) as { state: string }).state);
    expect(states.sort()).toEqual(['appear', 'leave_now', 'soon']);
  });

  it('cada pantalla tiene fixtures normal y de error o vacío', () => {
    for (const screen of ['home', 'calendar', 'weather', 'house']) {
      const own = fixtures.filter((f) => schemaForFixture(f) === screen);
      expect(own, screen).toContain(`${screen}.json`);
      expect(own.some((f) => /-(errores|error|vacio|sin-eventos)\.json$/.test(f)), screen).toBe(true);
    }
  });

  it('rechaza campos inventados', () => {
    expect(contractErrors('house', { status: 'ok', summary: 'x', devices: [], color: 'rojo' })).not.toEqual([]);
  });

  it('exige mensaje cuando un bloque falla', () => {
    expect(contractErrors('weather', { status: 'error' })).not.toEqual([]);
    expect(contractErrors('weather', { status: 'error', message: 'Tiempo no disponible' })).toEqual([]);
  });

  it('exige los datos cuando un bloque está bien', () => {
    expect(contractErrors('weather', { status: 'ok' })).not.toEqual([]);
  });
});
