// Genera en build/preview/ el documento APL completo y los datos de cada pantalla, para pegarlos
// en la herramienta de autoría de APL de la consola de Alexa (pestañas APL y DATA).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { withShared } from '../skill/lambda/src/apl/render';
import type { ScreenId } from '../skill/lambda/src/apl/screens';
import { SCREENS } from '../skill/lambda/src/apl/screens';

const fixtures = 'contracts/fixtures';
const out = 'build/preview';
const fixture = (name: string): Record<string, unknown> => JSON.parse(readFileSync(join(fixtures, `${name}.json`), 'utf8'));
const withAlert = (state: string) => ({ ...fixture('home'), departureAlert: fixture(`departure-alert-${state}`) });

const VARIANTS: Array<[name: string, screen: ScreenId, data: () => unknown]> = [
  ['inicio', 'inicio', () => fixture('home')],
  ['inicio-aviso-aparece', 'inicio', () => withAlert('appear')],
  ['inicio-aviso-falta-poco', 'inicio', () => withAlert('soon')],
  ['inicio-aviso-sal-ya', 'inicio', () => withAlert('leave-now')],
  ['inicio-errores', 'inicio', () => fixture('home-errores')],
  ['inicio-textos-largos', 'inicio', () => fixture('home-textos-largos')],
  ['calendario', 'calendario', () => fixture('calendar')],
  ['calendario-sin-eventos', 'calendario', () => fixture('calendar-sin-eventos')],
  ['calendario-error', 'calendario', () => fixture('calendar-error')],
  ['tiempo', 'tiempo', () => fixture('weather')],
  ['tiempo-error', 'tiempo', () => fixture('weather-error')],
  ['casa', 'casa', () => fixture('house')],
  ['casa-vacio', 'casa', () => fixture('house-vacio')],
];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const written = new Set<ScreenId>();
for (const [name, screen, data] of VARIANTS) {
  const { document, datasource } = SCREENS[screen];
  if (!written.has(screen)) {
    writeFileSync(join(out, `${screen}.apl.json`), JSON.stringify(withShared(document), null, 2) + '\n');
    written.add(screen);
  }
  writeFileSync(join(out, `${name}.data.json`), JSON.stringify({ [datasource]: data() }, null, 2) + '\n');
}
console.log(`Listo: ${out} (${written.size} documentos, ${VARIANTS.length} juegos de datos)`);
