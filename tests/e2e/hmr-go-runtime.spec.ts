import { expect, test } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { appendFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const cssPath = path.join(root, 'apps/web/src/application.css');
let proc: ChildProcess | undefined;
let home = '';
let bootstrap = '';
let originalCSS = '';

function startDev(): Promise<string> {
  proc = spawn(
    process.execPath,
    ['scripts/dev/full.mjs', 'examples/frontend-performance-foundations'],
    {
      cwd: root,
      env: { ...process.env, SYNAPLOOM_HOME: home },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('HMR startup timeout')), 60_000);
    proc?.stdout?.on('data', (chunk) => {
      const match = String(chunk).match(/http:\/\/127\.0\.0\.1:5173\/bootstrap\?token=[^\s]+/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    });
    proc?.once('exit', (code) => reject(new Error(`HMR process exited ${code}`)));
  });
}

async function stopDev(): Promise<void> {
  if (proc?.exitCode !== null) return;
  const exited = new Promise<void>((resolve) => proc?.once('exit', () => resolve()));
  proc.kill('SIGINT');
  await Promise.race([
    exited,
    new Promise<void>((resolve) =>
      setTimeout(() => {
        proc?.kill('SIGKILL');
        resolve();
      }, 5_000),
    ),
  ]);
}

test.beforeAll(async () => {
  home = await mkdtemp(path.join(tmpdir(), 'synaploom-hmr-'));
  originalCSS = await readFile(cssPath, 'utf8');
  bootstrap = await startDev();
});

test.afterAll(async () => {
  await writeFile(cssPath, originalCSS);
  await stopDev();
  if (home) await rm(home, { recursive: true, force: true });
});

test('loads a Go-backed lesson and hot-reloads a CSS change', async ({ page }) => {
  await page.goto(bootstrap);
  await expect(page.getByRole('heading', { name: 'Main Thread', level: 1 })).toBeVisible();

  try {
    const value = `hmr-${Date.now()}`;
    await appendFile(cssPath, `\n:root { --synaploom-hmr-sentinel: ${value}; }\n`);

    await expect
      .poll(() =>
        page
          .locator('html')
          .evaluate((element) =>
            getComputedStyle(element).getPropertyValue('--synaploom-hmr-sentinel').trim(),
          ),
      )
      .toBe(value);
  } finally {
    await writeFile(cssPath, originalCSS);
  }
});
