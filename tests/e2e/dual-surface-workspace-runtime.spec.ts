import { expect, test, type Page } from '@playwright/test';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { goCommand } from '../../scripts/go/go-command.mjs';

const exec = promisify(execFile);
let proc: ChildProcess | undefined;
let home = '';
let binary = '';
let bootstrap = '';

async function stopRuntime(): Promise<void> {
  if (proc?.exitCode !== null) return;
  const current = proc;
  const exited = new Promise<void>((resolve) => current.once('exit', () => resolve()));
  current.kill('SIGINT');
  await Promise.race([
    exited,
    new Promise<void>((resolve) =>
      setTimeout(() => {
        current.kill('SIGKILL');
        resolve();
      }, 5_000),
    ),
  ]);
  proc = undefined;
}

async function startRuntime(): Promise<string> {
  proc = spawn(binary, ['start', 'multi-domain-foundations', '--port', '0'], {
    env: { ...process.env, SYNAPLOOM_HOME: home },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise<string>((resolve, reject) => {
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
}

async function returnCodingInline(page: Page): Promise<void> {
  const practice = page.getByRole('region', { name: 'Khu vực thực hành' });
  const heading = practice.locator('h2[data-workspace-activity-heading]', {
    hasText: 'Viết chương trình tính tổng',
  });
  await expect(heading).toBeVisible();
  await practice.getByRole('button', { name: 'Làm tại đây' }).click();
  await expect(practice).toHaveCount(0);
}

async function expectTheoryScrolls(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  const viewport = page.locator('.syn-scroll-area__viewport').first();
  const dimensions = await viewport.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));

  expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);

  await viewport.hover();
  await page.mouse.wheel(0, 600);
  await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await viewport.evaluate((element) => {
    element.scrollTop = 0;
  });
}

test.beforeAll(async () => {
  home = await mkdtemp(path.join(tmpdir(), 'synaploom-dual-surface-e2e-'));
  binary = path.join(home, 'synaploom');
  if (process.env.SYNAPLOOM_E2E_BINARY) {
    await copyFile(process.env.SYNAPLOOM_E2E_BINARY, binary);
  } else {
    const command = goCommand(['build', '-p=1', '-o', binary, './cmd/synaploom']);
    await exec(command.file, command.args, {
      ...command.options,
      env: { ...command.options.env, GOMAXPROCS: '2' },
    });
  }
  await exec(binary, ['course', 'import', 'examples/multi-domain-foundations'], {
    env: { ...process.env, SYNAPLOOM_HOME: home },
  });
  bootstrap = await startRuntime();
});

test.afterAll(async () => {
  await stopRuntime();
  if (home) await rm(home, { recursive: true, force: true });
});

test('scrolls lesson content and persists workspace state across restart', async ({ page }) => {
  await page.goto(bootstrap);
  await expect(page.getByRole('heading', { name: 'Dòng chảy thuật toán', level: 1 })).toBeVisible();
  await expectTheoryScrolls(page, 1440);
  await expectTheoryScrolls(page, 1000);
  await page.setViewportSize({ width: 1440, height: 900 });

  await returnCodingInline(page);
  await expect(
    page.getByText('Chọn hoạt động thực hành, 2 hoạt động', { exact: true }),
  ).toBeVisible();

  const ordering = page.locator('[data-activity-id="algorithm-order"]');
  await ordering.getByRole('button', { name: /Di chuyển Đọc hai số a và b xuống/ }).click();
  await ordering.getByRole('button', { name: /Di chuyển Đọc hai số a và b lên/ }).click();
  await ordering.getByRole('button', { name: 'Mở trong khu vực thực hành' }).click();
  await expect(
    page.locator('h2[data-workspace-activity-heading]', { hasText: 'Sắp xếp thuật toán' }),
  ).toBeVisible();
  await expect(page.getByText('Sắp xếp thuật toán đang mở trong khu vực thực hành.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Di chuyển Đọc hai số a và b xuống/ })).toHaveCount(
    1,
  );

  const practice = page.getByRole('region', { name: 'Khu vực thực hành' });
  await practice.locator('summary').filter({ hasText: 'Hoạt động trong bài' }).click();
  await practice.getByRole('button', { name: /Viết chương trình tính tổng/ }).click();
  await expect(
    practice.locator('h2[data-workspace-activity-heading]', {
      hasText: 'Viết chương trình tính tổng',
    }),
  ).toBeVisible();

  const editor = page.getByRole('textbox', { name: 'Trình soạn thảo mã' });
  await expect(editor).toHaveValue(/return 0/);
  const source = 'function sum(a, b) {\n  return a + b;\n}\n\nconsole.log(sum(2, 3));\n';
  await editor.fill(source);
  const draftWrite = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' && response.url().includes('/workspace/file?path='),
  );
  await page.getByRole('button', { name: 'Thu gọn' }).click();
  expect((await draftWrite).ok()).toBe(true);
  await expect(
    page
      .getByLabel('Khu vực thực hành đang thu gọn')
      .getByText('Viết chương trình tính tổng đang tạm ẩn.'),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Khu vực thực hành' })).toHaveCount(0);

  await page.reload();
  await expect(
    page
      .getByLabel('Khu vực thực hành đang thu gọn')
      .getByText('Viết chương trình tính tổng đang tạm ẩn.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Mở lại Viết chương trình tính tổng' }).click();
  await expect(page.getByRole('textbox', { name: 'Trình soạn thảo mã' })).toHaveValue(source);

  await page.getByRole('button', { name: 'Thu gọn' }).click();
  await stopRuntime();
  bootstrap = await startRuntime();
  await page.goto(bootstrap);
  await expect(
    page
      .getByLabel('Khu vực thực hành đang thu gọn')
      .getByText('Viết chương trình tính tổng đang tạm ẩn.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Mở lại Viết chương trình tính tổng' }).click();
  await expect(page.getByRole('textbox', { name: 'Trình soạn thảo mã' })).toHaveValue(source);
});
