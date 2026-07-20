import esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Build Electron main and preload scripts
const result = await esbuild.build({
  entryPoints: [
    path.join(rootDir, 'electron/main.ts'),
    path.join(rootDir, 'electron/preload.ts'),
  ],
  bundle: false,
  outdir: path.join(rootDir, 'dist-electron'),
  platform: 'node',
  target: 'node18',
  external: ['electron'],
  format: 'esm',
});

console.log('✓ Electron scripts compiled successfully');
