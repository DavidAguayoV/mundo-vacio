import { defineConfig } from 'vitest/config';

// base relativa: el mismo build funciona en https://<usuario>.github.io/<repo>/ y abierto localmente.
export default defineConfig({
  base: './',
  build: { target: 'es2020', outDir: 'dist' },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
