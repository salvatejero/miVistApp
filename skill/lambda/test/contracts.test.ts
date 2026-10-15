import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contractValidator, contractsDir, readJson, schemaId } from './helpers';

const ajv = contractValidator();

/** Qué esquema valida cada fixture, por prefijo del nombre del fichero. */
const schemaForFixture = (file: string): string => {
  const prefixes = ['departure-alert', 'home', 'calendar', 'weather', 'house'];
  const prefix = prefixes.find((p) => file.startsWith(p));
  if (!prefix) throw new Error(`Fixture sin esquema: ${file}`);
  return schemaId(prefix);
};

describe('contrato de datos', () => {
  const fixtures = readdirSync(join(contractsDir, 'fixtures')).filter((f) => f.endsWith('.json'));

  it.each(fixtures)('%s cumple su esquema', (file) => {
    const validate = ajv.getSchema(schemaForFixture(file));
    expect(validate).toBeDefined();
    const valid = validate!(readJson(join(contractsDir, 'fixtures', file)));
    expect(validate!.errors ?? []).toEqual([]);
    expect(valid).toBe(true);
  });

  it('hay un fixture para cada estado del aviso de salida', () => {
    const states = fixtures
      .filter((f) => f.startsWith('departure-alert'))
      .map((f) => (readJson(join(contractsDir, 'fixtures', f)) as { state: string }).state);
    expect(states.sort()).toEqual(['appear', 'leave_now', 'soon']);
  });

  it('rechaza campos inventados', () => {
    const validate = ajv.getSchema(schemaId('house'))!;
    expect(validate({ status: 'ok', summary: 'x', devices: [], color: 'rojo' })).toBe(false);
  });

  it('exige mensaje cuando un bloque falla', () => {
    const validate = ajv.getSchema(schemaId('weather'))!;
    expect(validate({ status: 'error' })).toBe(false);
    expect(validate({ status: 'error', message: 'Tiempo no disponible' })).toBe(true);
  });

  it('exige los datos cuando un bloque está bien', () => {
    const validate = ajv.getSchema(schemaId('weather'))!;
    expect(validate({ status: 'ok' })).toBe(false);
  });
});
