// Genera build/hosted/ con la estructura de un repositorio Alexa-hosted:
//   skill-package/  manifiesto y modelo de interacción
//   lambda/         index.js empaquetado (handler: index.handler) y package.json sin dependencias
import { build } from 'esbuild';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

const out = 'build/hosted';

await rm(out, { recursive: true, force: true });
await mkdir(`${out}/lambda`, { recursive: true });

await build({
  entryPoints: ['skill/lambda/src/index.ts'],
  outfile: `${out}/lambda/index.js`,
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: true,
  logLevel: 'info',
});

await writeFile(
  `${out}/lambda/package.json`,
  JSON.stringify({ name: 'mivistapp-lambda', version: '0.1.0', private: true, main: 'index.js' }, null, 2) + '\n',
);
await cp('skill/skill-package', `${out}/skill-package`, { recursive: true });

console.log(`Listo: ${out}`);
