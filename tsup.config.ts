import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.mjs', 'src/automationRunner.js'],
  format: ['esm'],
  sourcemap: true,
  dts: false,
  splitting: false,
  clean: true,
  outDir: 'dist',
  shims: false,
  minify: false,
  target: 'node18',
  platform: 'node'
});
