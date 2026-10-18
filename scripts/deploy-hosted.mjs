// Copia la skill empaquetada (build/hosted) al repositorio de Alexa-hosted clonado con
// `ask init --hosted-skill-id …`, conservando el endpoint de su Lambda. Después: git commit y git push.
//
//   npm run build
//   npm run deploy:hosted -- ../mi-vistapp-hosted
import { cp, readFile, rm, writeFile } from 'node:fs/promises';
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

console.log(`Copiado a ${repo}. Revisa con "git status" y publica con:
  cd ${target} && git add -A && git commit -m "Mi VistApp" && git push`);
