// Copia la skill empaquetada (build/hosted) al repositorio de Alexa-hosted clonado con
// `ask init --hosted-skill-id …`, conservando el endpoint de su Lambda; lo sube (git push) y compila el
// modelo de voz, porque el push no siempre lo hace y sin modelo Alexa no reconoce el nombre de invocación.
//
//   npm run build
//   npm run deploy:hosted -- ../mi-vistapp-hosted
import { execFileSync } from 'node:child_process';
import { cp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { mergeManifest } from './hosted-manifest.mjs';

const target = process.argv[2];
if (!target) {
  console.error('Uso: npm run deploy:hosted -- <carpeta del repositorio de Alexa-hosted>');
  process.exit(1);
}
const repo = resolve(target);
const hostedManifestPath = join(repo, 'skill-package', 'skill.json');
if (!existsSync(join(repo, '.git')) || !existsSync(hostedManifestPath)) {
  console.error(`${repo} no parece el repositorio de una skill Alexa-hosted (falta .git o skill-package/skill.json)`);
  process.exit(1);
}
if (!existsSync('build/hosted/lambda/index.js')) {
  console.error('Falta build/hosted: ejecuta antes `npm run build`');
  process.exit(1);
}

const ours = JSON.parse(await readFile('build/hosted/skill-package/skill.json', 'utf8'));
const hosted = JSON.parse(await readFile(hostedManifestPath, 'utf8'));
const merged = mergeManifest(ours, hosted);
if (!merged.manifest.apis.custom.endpoint) {
  console.error('El skill.json de Alexa-hosted no tiene endpoint: ¿es el repositorio correcto?');
  process.exit(1);
}

// Lambda: solo nuestro index.js empaquetado y su package.json (sin dependencias que instalar).
await rm(join(repo, 'lambda'), { recursive: true, force: true });
await cp('build/hosted/lambda', join(repo, 'lambda'), { recursive: true });
// Modelo de interacción y manifiesto mezclado.
await cp('build/hosted/skill-package/interactionModels', join(repo, 'skill-package', 'interactionModels'), { recursive: true });
await writeFile(hostedManifestPath, JSON.stringify(merged, null, 2) + '\n');

const run = (cmd, args) => execFileSync(cmd, args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

run('git', ['add', '-A']);
if (run('git', ['status', '--porcelain']).trim()) {
  run('git', ['commit', '-m', 'Mi VistApp']);
  run('git', ['push']);
  console.log('Subido a Alexa-hosted: despliega la Lambda en uno o dos minutos.');
} else {
  console.log('Sin cambios en el código: no hay nada que subir.');
}

const skillId = JSON.parse(await readFile(join(repo, '.ask', 'ask-states.json'), 'utf8')).profiles.default.skillId;
const modelsDir = join(repo, 'skill-package', 'interactionModels', 'custom');
for (const file of await readdir(modelsDir)) {
  const locale = file.replace(/\.json$/, '');
  run('ask', ['smapi', 'set-interaction-model', '-s', skillId, '-g', 'development', '-l', locale, '--interaction-model', `file:${join(modelsDir, file)}`]);
  console.log(`Compilando el modelo de voz ${locale}…`);
  for (;;) {
    await sleep(5000);
    const status = JSON.parse(run('ask', ['smapi', 'get-skill-status', '-s', skillId, '--resource', 'interactionModel'])).interactionModel?.[locale]
      ?.lastUpdateRequest?.status;
    if (status === 'IN_PROGRESS') continue;
    if (status !== 'SUCCEEDED') {
      console.error(`El modelo ${locale} no se ha compilado (${status}): mira la consola, pestaña Build`);
      process.exit(1);
    }
    console.log(`Modelo ${locale} compilado.`);
    break;
  }
}
