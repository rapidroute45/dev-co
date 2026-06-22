import { build } from 'esbuild';
import { globSync } from 'glob';
import { rmSync } from 'node:fs';

const entryPoints = globSync('src/**/*.ts', { nodir: true });

if (entryPoints.length === 0) {
  console.error('[build] No TypeScript entry files found under src/');
  process.exit(1);
}

rmSync('dist', { recursive: true, force: true });

await build({
  entryPoints,
  outdir: 'dist',
  outbase: 'src',
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  sourcemap: true,
  logLevel: 'info',
  packages: 'external',
});

console.log(`[build] Compiled ${entryPoints.length} files to dist/`);
