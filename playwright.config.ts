import { access } from 'node:fs/promises';
import chromium from '@sparticuz/chromium';
import { defineConfig, type LaunchOptions } from '@playwright/test';

async function accessible(target: string | undefined): Promise<string | undefined> {
  if (!target) return undefined;
  try {
    await access(target);
    return target;
  } catch {
    return undefined;
  }
}

/**
 * Resolves a browser that is controlled by the repository rather than host policies.
 *
 * Contributors can explicitly provide a Playwright-compatible Chromium binary. Linux CI
 * falls back to the Chromium package pinned in the lockfile, avoiding mandatory policies
 * that may be attached to a system Chrome installation.
 */
async function launchOptions(): Promise<LaunchOptions> {
  const configured = await accessible(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH);
  if (configured) return { executablePath: configured };

  if (process.platform === 'linux') {
    return {
      args: chromium.args,
      executablePath: await chromium.executablePath(),
    };
  }

  for (const candidate of ['/usr/bin/chromium', '/usr/bin/google-chrome']) {
    const executablePath = await accessible(candidate);
    if (executablePath) return { executablePath };
  }
  return {};
}

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  fullyParallel: false,
  projects: [
    {
      name: 'go-runtime',
      testMatch: /(?:go|multi-domain|dual-surface-workspace)-runtime\.spec\.ts/,
    },
  ],
  use: {
    headless: true,
    launchOptions: await launchOptions(),
  },
});
