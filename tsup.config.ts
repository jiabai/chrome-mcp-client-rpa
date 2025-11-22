import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/ts/**/*.ts'],
  format: ['esm'],
  sourcemap: true,
  dts: true,
  splitting: false,
  clean: true,
  outDir: 'dist',
  shims: false,
  minify: false,
  target: 'node18',
  platform: 'node',
  tsconfig: './tsconfig.json'
});
