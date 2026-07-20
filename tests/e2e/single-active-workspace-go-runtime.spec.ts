import { expect, test, type Page } from '@playwright/test';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { goCommand } from '../../scripts/go/go-command.mjs';

const exec = promisify(execFile);
const canonicalViewport = { width: 1672, height: 941 } as const;
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

async function prepareCanonicalOrderingState(page: Page): Promise<void> {
  await page.clock.install({ time: new Date('2026-07-20T07:32:00Z') });
  await page.setViewportSize(canonicalViewport);
  await page.goto(bootstrap);
  await expect(page.getByRole('heading', { name: 'Dòng chảy thuật toán', level: 1 })).toBeVisible();

  await openActivity(page, 'Sắp xếp thuật toán');
  await page.getByRole('button', { name: 'Di chuyển Hiển thị kết quả lên' }).click();
  await page.getByRole('button', { name: 'Lưu bản nháp' }).click();

  await expect(
    page.locator('.syn-activity-host__state', { hasText: 'Đã lưu bản nháp.' }),
  ).toBeVisible();
  const rows = page.locator('.syn-activity-ordering > li');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('Đọc hai số a và b');
  await expect(rows.nth(1)).toContainText('Hiển thị kết quả');
  await expect(rows.nth(2)).toContainText('Tính a + b');
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
  await prepareCanonicalOrderingState(page);

  const secondSummary = page
    .locator('[data-activity-summary-card]')
    .filter({ hasText: 'Viết chương trình tính tổng' });
  const note = page.getByRole('note', { name: 'Ghi chú' });
  const [secondSummaryBox, noteBox] = await Promise.all([
    secondSummary.boundingBox(),
    note.boundingBox(),
  ]);
  expect(secondSummaryBox).not.toBeNull();
  expect(noteBox).not.toBeNull();
  expect(secondSummaryBox!.y).toBeLessThan(noteBox!.y);

  const headerBox = await page.locator('.syn-app-header').boundingBox();
  const brandBox = await page.locator('.syn-app-header__brand').boundingBox();
  const dividerBox = await page.getByTestId('app-header-divider').boundingBox();
  const profileBox = await page.getByLabel('Hồ sơ người học').boundingBox();
  expect(headerBox).not.toBeNull();
  expect(brandBox).not.toBeNull();
  expect(dividerBox).not.toBeNull();
  expect(profileBox).not.toBeNull();
  expect(headerBox!.height).toBeGreaterThanOrEqual(56);
  expect(headerBox!.height).toBeLessThanOrEqual(64);
  expect(dividerBox!.x).toBeGreaterThan(brandBox!.x + brandBox!.width);
  expect(profileBox!.x + profileBox!.width).toBeLessThanOrEqual(canonicalViewport.width - 24);

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
  const practiceNavigatorGap = navigatorBox!.x - (practiceBox!.x + practiceBox!.width);
  expect(theoryBox!.x + theoryBox!.width).toBeLessThanOrEqual(practiceBox!.x + 2);
  expect(theoryBox!.width / canonicalViewport.width).toBeGreaterThanOrEqual(0.45);
  expect(theoryBox!.width / canonicalViewport.width).toBeLessThanOrEqual(0.47);
  expect(practiceBox!.width / canonicalViewport.width).toBeGreaterThanOrEqual(0.36);
  expect(practiceBox!.width / canonicalViewport.width).toBeLessThanOrEqual(0.4);
  expect(navigatorBox!.width).toBeGreaterThanOrEqual(216);
  expect(navigatorBox!.width).toBeLessThanOrEqual(232);
  expect(practiceNavigatorGap).toBeGreaterThanOrEqual(12);
  expect(practiceNavigatorGap).toBeLessThanOrEqual(24);
  const navigator = page.getByRole('navigation', { name: 'Danh sách hoạt động' });
  await expect(
    navigator.getByRole('button', { name: /1\. Sắp xếp thuật toán\. Đang làm/ }),
  ).toHaveAttribute('aria-current', 'true');
  await expect(
    navigator.getByRole('button', { name: /2\. Viết chương trình tính tổng\. Chưa mở/ }),
  ).toBeVisible();
  await expect(navigator.locator('[data-navigator-header-chevron]')).toBeVisible();

  const theoryArticle = page.locator('[data-theory-reading-column]');
  const progressCard = page.locator('[data-lesson-progress-card]');
  const summaries = page.locator('[data-activity-summary-card]');
  const [articleBox, progressBox, firstSummaryBox, compactSecondSummaryBox] = await Promise.all([
    theoryArticle.boundingBox(),
    progressCard.boundingBox(),
    summaries.nth(0).boundingBox(),
    summaries.nth(1).boundingBox(),
  ]);
  expect(articleBox).not.toBeNull();
  expect(progressBox).not.toBeNull();
  expect(firstSummaryBox).not.toBeNull();
  expect(compactSecondSummaryBox).not.toBeNull();
  expect(articleBox!.x - theoryBox!.x).toBeGreaterThanOrEqual(40);
  expect(articleBox!.x - theoryBox!.x).toBeLessThanOrEqual(56);
  expect(
    theoryBox!.x + theoryBox!.width - (articleBox!.x + articleBox!.width),
  ).toBeGreaterThanOrEqual(40);
  expect(progressBox!.height).toBeLessThanOrEqual(92);
  expect(firstSummaryBox!.height).toBeGreaterThanOrEqual(84);
  expect(firstSummaryBox!.height).toBeLessThanOrEqual(104);
  expect(compactSecondSummaryBox!.y + compactSecondSummaryBox!.height).toBeLessThanOrEqual(
    noteBox!.y,
  );

  const panelBottoms = [theoryBox!, practiceBox!, navigatorBox!].map((box) => box.y + box.height);
  expect(Math.max(...panelBottoms) - Math.min(...panelBottoms)).toBeLessThanOrEqual(2);

  const workspaceMainBox = await page.locator('[data-workspace-main]').boundingBox();
  const assistantBox = await page.getByTestId('workspace-assistant').boundingBox();
  expect(workspaceMainBox).not.toBeNull();
  expect(assistantBox).not.toBeNull();
  expect(
    Math.abs(workspaceMainBox!.y + workspaceMainBox!.height - assistantBox!.y),
  ).toBeLessThanOrEqual(2);
  expect(assistantBox!.y + assistantBox!.height).toBeLessThanOrEqual(canonicalViewport.height + 1);
  const assistantDockBox = await page
    .getByRole('complementary', { name: 'Trợ lý AI' })
    .boundingBox();
  expect(assistantDockBox).not.toBeNull();
  expect(assistantDockBox!.width / canonicalViewport.width).toBeGreaterThanOrEqual(0.7);
  expect(assistantDockBox!.width / canonicalViewport.width).toBeLessThanOrEqual(0.76);
  expect(
    Math.abs(assistantDockBox!.x - (canonicalViewport.width - assistantDockBox!.width) / 2),
  ).toBeLessThanOrEqual(3);
  expect(assistantDockBox!.height).toBeGreaterThanOrEqual(56);
  expect(assistantDockBox!.height).toBeLessThanOrEqual(64);
  await expect(page.getByRole('textbox', { name: 'Câu hỏi cho Trợ lý AI' })).toHaveAttribute(
    'placeholder',
    'Đặt câu hỏi về bài học này…',
  );
  await expect(page.getByRole('progressbar', { name: 'Tiến độ bài học' })).toBeVisible();
  await expect(page.getByText(/\[!NOTE\]/)).toHaveCount(0);
  await expect(page.getByRole('note', { name: 'Ghi chú' })).toBeVisible();

  await openActivity(page, 'Sắp xếp thuật toán');
  const card = page.getByTestId('practice-workspace-card');
  const cardBox = await card.boundingBox();
  const practiceContentBox = await page.getByTestId('practice-workspace-content').boundingBox();
  const practiceFooterBox = await page.getByTestId('practice-workspace-footer').boundingBox();
  expect(cardBox).not.toBeNull();
  expect(practiceContentBox).not.toBeNull();
  expect(practiceFooterBox).not.toBeNull();
  expect(cardBox!.x).toBeGreaterThan(practiceBox!.x);
  expect(cardBox!.y).toBeGreaterThan(practiceBox!.y);
  expect(practiceFooterBox!.y).toBeGreaterThanOrEqual(
    practiceContentBox!.y + practiceContentBox!.height - 1,
  );
  expect(practiceFooterBox!.y + practiceFooterBox!.height).toBeLessThanOrEqual(
    cardBox!.y + cardBox!.height + 1,
  );
  await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.getByTestId('practice-workspace-content')).toHaveCSS(
    'background-color',
    'rgb(255, 255, 255)',
  );
  await expect(page.getByTestId('practice-footer-status')).toContainText(
    'Đã lưu bản nháp lúc 14:32',
  );
  await expect(page.getByRole('button', { name: 'Hoạt động tiếp theo' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Danh sách hoạt động' })).toBeVisible();
  const orderingRows = page.locator('.syn-activity-ordering > li');
  const firstRowBox = await orderingRows.nth(0).boundingBox();
  const secondRowBox = await orderingRows.nth(1).boundingBox();
  expect(firstRowBox).not.toBeNull();
  expect(secondRowBox).not.toBeNull();
  expect(firstRowBox!.height).toBeGreaterThanOrEqual(78);
  expect(firstRowBox!.height).toBeLessThanOrEqual(88);
  expect(secondRowBox!.y - (firstRowBox!.y + firstRowBox!.height)).toBeGreaterThanOrEqual(10);
  await expect(page.locator('[data-ordering-drag-handle]')).toHaveCount(3);
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
  const compactTitleBox = await page
    .getByRole('heading', { name: 'Dòng chảy thuật toán', level: 1 })
    .boundingBox();
  const compactAssistantBox = await page.getByTestId('workspace-assistant').boundingBox();
  expect(compactTitleBox).not.toBeNull();
  expect(compactAssistantBox).not.toBeNull();
  expect(compactTitleBox!.height).toBeLessThanOrEqual(120);
  expect(compactAssistantBox!.y + compactAssistantBox!.height).toBeLessThanOrEqual(901);
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
  const [checkActionBox, runActionBox] = await Promise.all([
    page.getByRole('button', { name: 'Kiểm tra kết quả' }).boundingBox(),
    page.getByRole('button', { name: 'Chạy chương trình' }).boundingBox(),
  ]);
  expect(checkActionBox).not.toBeNull();
  expect(runActionBox).not.toBeNull();
  expect(checkActionBox!.width).toBeGreaterThanOrEqual(120);
  expect(runActionBox!.width).toBeGreaterThanOrEqual(120);
  expect(checkActionBox!.height).toBeLessThanOrEqual(64);
  expect(runActionBox!.height).toBeLessThanOrEqual(64);
  await expectSingleEditor(page);
  await expect(page).toHaveScreenshot('single-active-mobile.png', { fullPage: true });
});
