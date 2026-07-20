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
}

async function openActivity(page: Page, title: string): Promise<void> {
  const heading = page.locator('h2[data-workspace-activity-heading]', { hasText: title });
  if (await heading.isVisible().catch(() => false)) return;

  const permanentNavigator = page.getByRole('navigation', { name: 'Danh sách hoạt động' });
  if (await permanentNavigator.isVisible().catch(() => false)) {
    await permanentNavigator.getByRole('button', { name: new RegExp(title) }).click();
  } else {
    const summary = page.locator('[data-activity-id]').filter({ hasText: title }).first();
    await summary
      .getByRole('button', { name: /Thực hành bài này|Quay lại thực hành|Mở lại thực hành/ })
      .click();
  }
  await expect(heading).toBeVisible();
}

async function expectSingleEditor(page: Page): Promise<void> {
  await expect(page.locator('[data-active-activity-editor]')).toHaveCount(1);
  await expect(
    page.locator('.syn-activity-summary input, .syn-activity-summary textarea'),
  ).toHaveCount(0);
}

test.beforeAll(async () => {
  home = await mkdtemp(path.join(tmpdir(), 'synaploom-revision-two-e2e-'));
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
  await exec(binary, ['course', 'import', 'examples/multi-domain-foundations'], {
    env: { ...process.env, SYNAPLOOM_HOME: home },
  });
  proc = spawn(binary, ['start', 'multi-domain-foundations', '--port', '0'], {
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

test('matches Revision 2 geometry across six responsive states', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto(bootstrap);
  await expect(page.getByRole('heading', { name: 'Dòng chảy thuật toán', level: 1 })).toBeVisible();

  const theory = page.locator('[data-workspace-theory-zone]');
  const practiceZone = page.locator('[data-workspace-practice-zone]');
  const navigatorZone = page.locator('[data-workspace-navigator-zone]');
  await expect(theory).toBeVisible();
  await expect(practiceZone).toBeVisible();
  await expect(navigatorZone).toBeVisible();
  const [theoryBox, practiceBox, navigatorBox] = await Promise.all([
    theory.boundingBox(),
    practiceZone.boundingBox(),
    navigatorZone.boundingBox(),
  ]);
  expect(theoryBox).not.toBeNull();
  expect(practiceBox).not.toBeNull();
  expect(navigatorBox).not.toBeNull();
  expect(theoryBox!.x + theoryBox!.width).toBeLessThanOrEqual(practiceBox!.x + 2);
  expect(practiceBox!.x + practiceBox!.width).toBeLessThanOrEqual(navigatorBox!.x + 2);
  expect(theoryBox!.width / 1600).toBeGreaterThan(0.42);
  expect(theoryBox!.width / 1600).toBeLessThan(0.5);

  await openActivity(page, 'Sắp xếp thuật toán');
  const card = page.getByTestId('practice-workspace-card');
  const cardBox = await card.boundingBox();
  expect(cardBox).not.toBeNull();
  expect(cardBox!.x).toBeGreaterThan(practiceBox!.x);
  expect(cardBox!.y).toBeGreaterThan(practiceBox!.y);
  await expectSingleEditor(page);
  await expect(page).toHaveScreenshot('single-active-ordering-wide.png', { fullPage: true });

  await openActivity(page, 'Viết chương trình tính tổng');
  const coding = page.locator('[data-activity-surface="practice-contained"]');
  await expect(coding).toBeVisible();
  const codingBox = await coding.boundingBox();
  const contentBox = await page.getByTestId('practice-workspace-content').boundingBox();
  expect(codingBox).not.toBeNull();
  expect(contentBox).not.toBeNull();
  expect(codingBox!.height).toBeLessThanOrEqual(contentBox!.height + 1);
  await expectSingleEditor(page);
  await expect(page).toHaveScreenshot('single-active-coding-wide.png', { fullPage: true });

  await page.getByRole('button', { name: 'Thu gọn' }).click();
  const rail = page.locator('[data-workspace-practice-rail]');
  await expect(rail).toBeVisible();
  await expect(rail).toHaveCSS('width', '56px');
  await expect(page).toHaveScreenshot('single-active-collapsed-wide.png', { fullPage: true });

  await page.setViewportSize({ width: 1366, height: 900 });
  await page.getByRole('button', { name: /Mở lại Viết chương trình tính tổng/ }).click();
  await page.getByRole('button', { name: 'Danh sách hoạt động' }).click();
  await expect(page.getByRole('dialog', { name: 'Danh sách hoạt động' })).toBeVisible();
  await expect(page.locator('[data-workspace-navigator-zone]')).toHaveCount(0);
  await expect(page).toHaveScreenshot('single-active-navigator-1366.png', { fullPage: true });

  await page.setViewportSize({ width: 900, height: 900 });
  await expect(page.getByRole('button', { name: 'Lý thuyết' })).toBeVisible();
  await expect(page.locator('[data-active-activity-editor]')).toHaveCount(1);
  await expect(page).toHaveScreenshot('single-active-compact.png', { fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileDialog = page.getByRole('dialog', { name: /Viết chương trình tính tổng/ });
  await expect(mobileDialog).toBeVisible();
  const mobileBox = await mobileDialog.boundingBox();
  expect(mobileBox).not.toBeNull();
  expect(Math.abs(mobileBox!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(mobileBox!.y)).toBeLessThanOrEqual(1);
  expect(mobileBox!.width).toBeLessThanOrEqual(391);
  expect(mobileBox!.height).toBeLessThanOrEqual(845);
  await expectSingleEditor(page);
  await expect(page).toHaveScreenshot('single-active-mobile.png', { fullPage: true });
});
