import { expect, test } from '@playwright/test';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { goCommand } from '../../scripts/go/go-command.mjs';

const exec = promisify(execFile);
let proc: ChildProcess | undefined;
let home = '';
let bootstrap = '';

async function stopRuntime(): Promise<void> {
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
  home = await mkdtemp(path.join(tmpdir(), 'synaploom-e2e-'));
  const binary = path.join(home, 'synaploom');
  if (process.env.SYNAPLOOM_E2E_BINARY) {
    await copyFile(process.env.SYNAPLOOM_E2E_BINARY, binary);
  } else {
    const command = goCommand(['build', '-p=1', '-o', binary, './cmd/synaploom']);
    await exec(command.file, command.args, {
      ...command.options,
      env: { ...command.options.env, GOMAXPROCS: '2' },
    });
  }
  await exec(binary, ['course', 'import', 'examples/frontend-performance-foundations'], {
    env: { ...process.env, SYNAPLOOM_HOME: home },
  });
  proc = spawn(binary, ['start', 'frontend-performance-foundations', '--port', '0'], {
    env: { ...process.env, SYNAPLOOM_HOME: home },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  bootstrap = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('startup timeout')), 30_000);
    proc?.stdout?.on('data', (chunk) => {
      const match = String(chunk).match(/http:\/\/[^\s]+\/bootstrap\?token=[^\s]+/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    });
    proc?.on('exit', (code) => reject(new Error(`native runtime exited ${code}`)));
  });
});

test.afterAll(async () => {
  await stopRuntime();
  if (home) await rm(home, { recursive: true, force: true });
});

test('serves the embedded learner UI from the Go runtime', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });

  await page.goto(bootstrap);
  await expect(page.locator('#root')).not.toBeEmpty();
  await expect(page.getByRole('navigation', { name: 'Điều hướng khóa học' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Main Thread', level: 1 })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Chọn chương' })).toHaveValue(
    'javascript-runtime',
  );
  expect(browserErrors).toEqual([]);
  expect(await readFile('internal/webassets/inventory.json', 'utf8')).toContain('index.html');
});
