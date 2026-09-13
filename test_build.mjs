import { build } from 'esbuild';
build({
  entryPoints: ['src/measurement/accuracy-engine.ts'],
  outdir: 'content',
  format: 'iife',
  bundle: true,
  target: 'es2022'
}).catch(() => process.exit(1));
