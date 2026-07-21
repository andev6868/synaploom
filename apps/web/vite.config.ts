import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type UserConfig } from 'vite';

const defaultDaemonOrigin = 'http://127.0.0.1:4174';

export function createDevServerOptions(
  daemonOrigin = process.env.SYNAPLOOM_DAEMON_ORIGIN ?? defaultDaemonOrigin,
): NonNullable<UserConfig['server']> {
  return {
    host: '127.0.0.1',
    proxy: {
      '/api': { target: daemonOrigin, changeOrigin: false },
      '/bootstrap': { target: daemonOrigin, changeOrigin: false },
    },
  };
}

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
  server: createDevServerOptions(),
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
