import { StaticAplTemplateValidator } from 'apl-suggester';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { withShared } from '../src/apl/render';
import { SCREEN_IDS, SCREENS } from '../src/apl/screens';
import graphics from '../../apl/shared/graphics.json';
import layouts from '../../apl/shared/layouts.json';
import theme from '../../apl/shared/theme.json';
import { contractsDir, readJson } from './helpers';

type Json = unknown;

/** Recorre un JSON y devuelve todas las cadenas, con la clave que las contiene. */
function strings(value: Json, key = ''): Array<[string, string]> {
  if (typeof value === 'string') return [[key, value]];
  if (Array.isArray(value)) return value.flatMap((item) => strings(item, key));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => strings(v, k));
  return [];
}

/** Componentes (objetos con `type`) dentro de item/items, sin entrar en comandos ni gráficos. */
function components(value: Json): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.flatMap(components);
  if (!value || typeof value !== 'object') return [];
  const node = value as Record<string, unknown>;
  const children = [node.item, node.items].filter(Boolean).flatMap(components);
  return typeof node.type === 'string' ? [node, ...children] : children;
}

const PRIMITIVES = ['Container', 'Frame', 'Text', 'TouchWrapper', 'VectorGraphic', 'Sequence', 'Image', 'ScrollView', 'GridSequence', 'Pager'];
const layoutNames = Object.keys(layouts.layouts);
const resourceNames = new Set([...Object.keys(theme.colors), ...Object.keys(theme.strings), ...Object.keys(theme.dimensions)]);
const screenDocs = SCREEN_IDS.map((id) => [id, SCREENS[id].document] as const);
const sources = [...screenDocs.map(([id, doc]) => [id, doc] as const), ['layouts', layouts] as const];

// Único aviso aceptado: el validador no sabe que el tamaño del padre lo da el reparto flexible.
const ACCEPTED_WARNING = /must be an absolute value when the parent (width|height) is set to auto/;

describe('documentos APL', () => {
  it.each(SCREEN_IDS)('%s pasa el validador oficial de APL', async (id) => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined); // el validador escribe trazas propias
    const results = await new StaticAplTemplateValidator().validate(withShared(SCREENS[id].document));
    const unexpected = results.filter((r) => r.level !== 'WARNING' || !ACCEPTED_WARNING.test(r.errorMessage));
    expect(unexpected).toEqual([]);
  });

  it.each(sources)('%s solo usa recursos del tema', (_, doc) => {
    const used = strings(doc).flatMap(([, s]) => [...s.matchAll(/@([A-Za-z][A-Za-z0-9]*)/g)].map((m) => m[1]!));
    expect(used.filter((name) => !resourceNames.has(name))).toEqual([]);
  });

  it.each(sources)('%s solo usa componentes de APL o del paquete compartido', (_, doc) => {
    const root =
      'mainTemplate' in doc ? doc.mainTemplate : Object.values(doc.layouts as Record<string, { item: Json }>).map((l) => l.item);
    const types = components(root).map((c) => c.type as string);
    expect(types.filter((t) => !PRIMITIVES.includes(t) && !layoutNames.includes(t))).toEqual([]);
  });

  it('cada icono que se usa existe', () => {
    const literal = sources
      .flatMap(([, doc]) => strings(doc))
      .filter(([key, s]) => key === 'source' && !s.includes('${'))
      .map(([, s]) => s);
    const menuIcons = strings(layouts).filter(([key]) => key === 'icon').map(([, s]) => s).filter((s) => !s.includes('${'));
    const common = readJson(join(contractsDir, 'schemas/common.schema.json')) as {
      $defs: { weatherIcon: { enum: string[] } };
    };
    const weather = common.$defs.weatherIcon.enum.map((icon) => `weather-${icon}`);
    const needed = [...literal, ...menuIcons, ...weather, 'iconLight', 'iconPlug', 'iconBlind', 'iconChevronLeft', 'iconChevronRight'];
    expect(needed.filter((name) => !(name in graphics.graphics))).toEqual([]);
  });

  it('ningún texto baja de 16 dp', () => {
    const textSizes = Object.entries(theme.dimensions).filter(([name]) => name.startsWith('text'));
    expect(textSizes.filter(([, size]) => size < 16)).toEqual([]);
  });

  it('el tema define los tamaños de Echo Show 15', () => {
    expect(theme.xlScale).toBeGreaterThan(1);
  });
});

/** Esquemas del contrato, para comprobar que las pantallas solo leen campos que existen. */
const schemaFiles: Record<string, Json> = Object.fromEntries(
  ['common', 'home', 'calendar', 'weather', 'house'].map((n) => [
    `${n}.schema.json`,
    JSON.parse(readFileSync(join(contractsDir, 'schemas', `${n}.schema.json`), 'utf8')),
  ]),
);

interface SchemaNode {
  $ref?: string;
  properties?: Record<string, SchemaNode | boolean>;
  items?: SchemaNode;
  allOf?: SchemaNode[];
  oneOf?: SchemaNode[];
  type?: string | string[];
}

function resolve(node: SchemaNode, file: string): Array<[SchemaNode, string]> {
  if (node.$ref) {
    const [target, pointer = ''] = node.$ref.split('#');
    const nextFile = target || file;
    let found = schemaFiles[nextFile] as SchemaNode;
    for (const part of pointer.split('/').filter(Boolean)) found = (found as Record<string, SchemaNode>)[part]!;
    return resolve(found, nextFile);
  }
  const variants = [...(node.allOf ?? []), ...(node.oneOf ?? [])].flatMap((n) => resolve(n, file));
  return [[node, file], ...variants];
}

function hasPath(node: SchemaNode, file: string, path: string[]): boolean {
  if (path.length === 0) return true;
  const [head, ...rest] = path;
  return resolve(node, file).some(([n, f]) => {
    if (head === 'length' && (n.type === 'array' || n.items)) return true;
    const child = n.properties?.[head!];
    return typeof child === 'object' && hasPath(child, f, rest);
  });
}

const def = (name: string): [SchemaNode, string] => [{ $ref: `common.schema.json#/$defs/${name}` }, 'common.schema.json'];

/** Qué parte del contrato representa cada variable en las pantallas y componentes. */
const VARIABLES: Record<string, [SchemaNode, string]> = {
  home: [schemaFiles['home.schema.json'] as SchemaNode, 'home.schema.json'],
  calendar: [schemaFiles['calendar.schema.json'] as SchemaNode, 'calendar.schema.json'],
  weather: [schemaFiles['weather.schema.json'] as SchemaNode, 'weather.schema.json'],
  house: [schemaFiles['house.schema.json'] as SchemaNode, 'house.schema.json'],
  entry: def('agendaItem'),
  alert: def('departureAlert'),
  device: def('device'),
  day: def('agendaDay'),
  rain: def('rainForecast'),
};

describe('las pantallas solo leen campos del contrato', () => {
  it.each(sources)('%s', (_, doc) => {
    const expressions = strings(doc).flatMap(([, s]) => [...s.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1]!));
    const references = expressions.flatMap((e) =>
      [...e.matchAll(/(?<![\w.'])([a-z]+)((?:\.[A-Za-z_][A-Za-z0-9_]*)+)/g)]
        .filter((m) => m[1]! in VARIABLES)
        .map((m) => [m[1]!, m[2]!.slice(1).split('.')] as const),
    );
    expect(references.length).toBeGreaterThan(0);
    const unknown = references.filter(([variable, path]) => !hasPath(...VARIABLES[variable]!, path)).map(([v, p]) => [v, ...p].join('.'));
    expect(unknown).toEqual([]);
  });
});
