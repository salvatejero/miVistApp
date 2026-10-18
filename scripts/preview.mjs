// Empaqueta scripts/preview.ts (importa TypeScript y JSON) y lo ejecuta.
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const outfile = 'build/preview-script.mjs';
await build({ entryPoints: ['scripts/preview.ts'], outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external', logLevel: 'error' });
await import(pathToFileURL(resolve(outfile)).href);
