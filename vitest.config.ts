import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  resolve: {
    conditions: ['development'],
    alias: { '#src': fileURLToPath(new URL('./apps/web/src', import.meta.url)) },
  },
  test: {
    fileParallelism: false,
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          execArgv: ['--disable-warning=ExperimentalWarning'],
          include: [
            'packages/{ai-contracts,contracts,course-loader,course-schema,course-validator,lesson-renderer,protocol,security,web-client}/src/**/*.test.ts',
            'tests/**/*.spec.ts',
            'tests/**/*.test.ts',
            'tests/conformance/**/*.test.ts',
          ],
          exclude: ['tests/e2e/**', 'tests/activity-engine-docs.spec.ts'],
        },
      },
      {
        test: {
          name: 'dom',
          environment: 'happy-dom',
          setupFiles: ['./tooling/test-config/setup-dom.ts'],
          include: [
            'apps/web/src/**/*.test.ts',
            'apps/web/src/**/*.test.tsx',
            'packages/ui/src/**/*.test.tsx',
          ],
        },
      },
    ],
  },
});
