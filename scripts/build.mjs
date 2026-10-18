// Genera:
//   build/hosted/   estructura de un repositorio Alexa-hosted
//     skill-package/  manifiesto y modelo de interacción
//     lambda/         index.js empaquetado (handler: index.handler) y package.json sin dependencias
//   build/vps/      server.cjs: el servicio de datos en un solo fichero (node build/vps/server.cjs)
import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

/** URL del VPS y clave para la skill: de skill/lambda/.env.local (no se sube al repo) o del entorno. */
async function skillSecrets() {
  const values = {
    VISTAPP_VPS_URL: process.env.VISTAPP_VPS_URL,
    VISTAPP_API_KEY: process.env.VISTAPP_API_KEY,
    VISTAPP_TIMEZONE: process.env.VISTAPP_TIMEZONE,
  };
  const file = await readFile('skill/lambda/.env.local', 'utf8').catch(() => '');
  for (const line of file.split('\n')) {
    const match = line.match(/^\s*(VISTAPP_VPS_URL|VISTAPP_API_KEY|VISTAPP_TIMEZONE)\s*=\s*(.*?)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return values;
}

const secrets = await skillSecrets();
// La clave viaja en la cabecera: sin HTTPS iría en claro por internet.
if (secrets.VISTAPP_VPS_URL && !secrets.VISTAPP_VPS_URL.startsWith('https://')) {
  console.error('VISTAPP_VPS_URL debe empezar por https://');
  process.exit(1);
}

const out = 'build/hosted';

await rm(out, { recursive: true, force: true });
await rm('build/vps', { recursive: true, force: true });
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
  define: {
    __VISTAPP_VPS_URL__: JSON.stringify(secrets.VISTAPP_VPS_URL ?? ''),
    __VISTAPP_API_KEY__: JSON.stringify(secrets.VISTAPP_API_KEY ?? ''),
    __VISTAPP_TIMEZONE__: JSON.stringify(secrets.VISTAPP_TIMEZONE ?? ''),
  },
});
console.log(secrets.VISTAPP_VPS_URL ? 'Skill conectada al VPS' : 'Skill con datos de ejemplo (sin VISTAPP_VPS_URL)');

await writeFile(
  `${out}/lambda/package.json`,
  JSON.stringify({ name: 'mivistapp-lambda', version: '0.1.0', private: true, main: 'index.js' }, null, 2) + '\n',
);
await cp('skill/skill-package', `${out}/skill-package`, { recursive: true });

await build({
  entryPoints: ['vps/src/main.ts'],
  outfile: 'build/vps/server.cjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  logLevel: 'info',
});

console.log(`Listo: ${out} y build/vps`);
