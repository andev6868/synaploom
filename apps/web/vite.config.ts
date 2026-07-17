import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

/** Vite configuration shared by local development and the packed CLI build. */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      '#src': fileURLToPath(new URL('./src', import.meta.url)),
    },
    conditions: ['development'],
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        const thirdParty = warning.id?.includes('/node_modules/') === true;
        if (
          thirdParty &&
          ['MODULE_LEVEL_DIRECTIVE', 'SOURCEMAP_ERROR'].includes(warning.code ?? '')
        ) {
          return;
        }
        warn(warning);
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
});
