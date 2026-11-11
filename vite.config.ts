import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

export default defineConfig({
  base: process.env.APP_BASE_PATH || '/ai-test/',
  plugins: [react(), {
    name: 'distribution-license',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'LICENSE', source: readFileSync(new URL('./LICENSE', import.meta.url), 'utf8') });
    },
  }],
  build: {
    license: { fileName: 'THIRD_PARTY_LICENSES.md' },
  },
  server: {
    port: 5174,
  },
  worker: {
    format: 'es',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['node_modules/**'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
