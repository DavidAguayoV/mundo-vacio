import { defineConfig } from 'vitest/config';

// base relativa: el mismo build funciona en https://<usuario>.github.io/<repo>/ y abierto localmente.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    // el juego completo y la demo (misma base de código, avance guardado aparte)
    rollupOptions: { input: { main: 'index.html', demo: 'demo.html' } },
  },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
