import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    fileParallelism: false,
    coverage: {
      exclude: ['src/**/*.module.ts'],
    },
  },
  plugins: [swc.vite()],
});
