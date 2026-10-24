import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  external: Object.keys(packageJson.dependencies),
  sourcemap: true,
  outfile: 'dist/index.js',
  logLevel: 'info',
});
