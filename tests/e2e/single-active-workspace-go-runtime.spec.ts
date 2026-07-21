import { expect, test, type Locator, type Page } from '@playwright/test';
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
  await page.route(/\/api\/courses\/[^/]+\/navigation(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const navigation = (await response.json()) as {
      chapters: Array<{ lessons: Array<{ status: string }> }>;
    };
    await route.fulfill({
      response,
      json: {
        ...navigation,
        chapters: navigation.chapters.map((chapter) => ({
          ...chapter,
          lessons: chapter.lessons.map((lesson) => ({ ...lesson, status: 'COMPLETED' })),
        })),
      },
    });
  });
  await page.setViewportSize(canonicalViewport);
  await page.goto(bootstrap);
  await expect(page.getByRole('heading', { name: 'Dòng chảy thuật toán', level: 1 })).toBeVisible();

  await openActivity(page, 'Sắp xếp thuật toán');
  const labels = page.locator('.syn-activity-ordering__label');
  const currentLabels = await labels.allTextContents();
  if (currentLabels[1] !== 'Hiển thị kết quả') {
    await page.getByRole('button', { name: 'Di chuyển Hiển thị kết quả lên' }).click();
  }
  await page.getByRole('button', { name: 'Lưu bản nháp' }).click();

  await expect(page.getByTestId('practice-footer-status')).toContainText(
    'Đã lưu bản nháp lúc 14:32',
  );
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

interface MeasuredBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

async function requiredBox(locator: Locator): Promise<MeasuredBox> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function workspaceGeometry(page: Page): Promise<{
  readonly theory: MeasuredBox;
  readonly practice: MeasuredBox;
  readonly navigator: MeasuredBox;
}> {
  const [theory, practice, navigator] = await Promise.all([
    requiredBox(page.locator('[data-workspace-theory-zone]')),
    requiredBox(page.locator('[data-workspace-practice-zone]')),
    requiredBox(page.locator('[data-workspace-navigator-zone]')),
  ]);
  return { theory, practice, navigator };
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

test('matches Revision 3 geometry across six responsive states', async ({ page }) => {
  await prepareCanonicalOrderingState(page);

  const secondSummary = page
    .locator('[data-activity-summary-card]')
    .filter({ hasText: 'Viết chương trình tính tổng' });
  const supportingHeading = page.getByRole('heading', {
    name: 'Mở trong khu vực thực hành',
  });
  const [secondSummaryBox, supportingHeadingBox] = await Promise.all([
    secondSummary.boundingBox(),
    supportingHeading.boundingBox(),
  ]);
  expect(secondSummaryBox).not.toBeNull();
  expect(supportingHeadingBox).not.toBeNull();
  expect(secondSummaryBox!.y).toBeLessThan(supportingHeadingBox!.y);

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
  expect(dividerBox!.x).toBeGreaterThanOrEqual(434);
  expect(dividerBox!.x).toBeLessThanOrEqual(438);
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
  expect(theoryBox!.width).toBeGreaterThanOrEqual(752);
  expect(theoryBox!.width).toBeLessThanOrEqual(756);
  expect(practiceBox!.x).toBeGreaterThanOrEqual(759);
  expect(practiceBox!.x).toBeLessThanOrEqual(761);
  expect(navigatorBox!.x).toBeGreaterThanOrEqual(1440);
  expect(navigatorBox!.x).toBeLessThanOrEqual(1444);
  expect(navigatorBox!.width).toBeGreaterThanOrEqual(216);
  expect(navigatorBox!.width).toBeLessThanOrEqual(220);
  expect(navigatorBox!.x + navigatorBox!.width).toBeLessThanOrEqual(1662);
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
  const articlePadding = await theoryArticle.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      left: Number.parseFloat(style.paddingLeft),
      right: Number.parseFloat(style.paddingRight),
    };
  });
  expect(articlePadding.left).toBeGreaterThanOrEqual(40);
  expect(articlePadding.left).toBeLessThanOrEqual(56);
  expect(articlePadding.right).toBeGreaterThanOrEqual(8);
  expect(articlePadding.right).toBeLessThanOrEqual(14);
  expect(progressBox!.height).toBeLessThanOrEqual(92);
  expect(firstSummaryBox!.height).toBeGreaterThanOrEqual(84);
  expect(firstSummaryBox!.height).toBeLessThanOrEqual(104);
  expect(compactSecondSummaryBox!.y + compactSecondSummaryBox!.height).toBeLessThanOrEqual(
    supportingHeadingBox!.y,
  );

  const panelBottoms = [theoryBox!, practiceBox!, navigatorBox!].map((box) => box.y + box.height);
  expect(Math.max(...panelBottoms) - Math.min(...panelBottoms)).toBeLessThanOrEqual(2);

  await expect(page.getByTestId('workspace-assistant')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Hỏi AI về lý thuyết' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hỏi AI về bài tập đang làm' })).toBeVisible();
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
  expect(cardBox!.x).toBeGreaterThanOrEqual(practiceBox!.x);
  expect(cardBox!.y).toBeGreaterThan(practiceBox!.y);
  expect(practiceFooterBox!.y).toBeGreaterThanOrEqual(
    practiceContentBox!.y + practiceContentBox!.height - 1,
  );
  expect(practiceFooterBox!.y + practiceFooterBox!.height).toBeLessThanOrEqual(
    cardBox!.y + cardBox!.height + 1,
  );
  await expect(card).toHaveCSS('background-color', 'oklch(1 0 0)');
  await expect(page.getByTestId('practice-workspace-content')).toHaveCSS(
    'background-color',
    'oklch(1 0 0)',
  );
  await expect(page.getByTestId('practice-footer-status')).toContainText(
    'Đã lưu bản nháp lúc 14:32',
  );
  await expect(page.getByRole('button', { name: 'Hoạt động tiếp theo' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Danh sách hoạt động' })).toBeVisible();
  expect(cardBox!.y).toBeGreaterThanOrEqual(82);
  expect(cardBox!.y).toBeLessThanOrEqual(86);
  expect(cardBox!.x).toBeGreaterThanOrEqual(783);
  expect(cardBox!.x).toBeLessThanOrEqual(787);
  expect(cardBox!.width).toBeGreaterThanOrEqual(619);
  expect(cardBox!.width).toBeLessThanOrEqual(623);
  const containedHost = page.locator('.syn-practice-pane__body > .syn-activity-host');
  await expect(containedHost).toHaveCSS('border-top-width', '0px');
  await expect(containedHost.locator('legend')).toBeHidden();
  const [collapseControlBox, activityListControlBox] = await Promise.all([
    page.getByRole('button', { name: 'Thu gọn' }).boundingBox(),
    page.getByRole('button', { name: 'Danh sách hoạt động' }).boundingBox(),
  ]);
  expect(collapseControlBox).not.toBeNull();
  expect(activityListControlBox).not.toBeNull();
  expect(activityListControlBox!.y).toBeGreaterThanOrEqual(
    collapseControlBox!.y + collapseControlBox!.height + 8,
  );
  const orderingRows = page.locator('.syn-activity-ordering > li');
  const firstRowBox = await orderingRows.nth(0).boundingBox();
  const secondRowBox = await orderingRows.nth(1).boundingBox();
  expect(firstRowBox).not.toBeNull();
  expect(secondRowBox).not.toBeNull();
  expect(firstRowBox!.height).toBeGreaterThanOrEqual(78);
  expect(firstRowBox!.height).toBeLessThanOrEqual(88);
  expect(secondRowBox!.y - (firstRowBox!.y + firstRowBox!.height)).toBeGreaterThanOrEqual(10);
  await expect(page.locator('[data-ordering-drag-handle]')).toHaveCount(3);
  expect(progressBox).not.toBeNull();
  expect(progressBox!.y).toBeGreaterThanOrEqual(84);
  expect(progressBox!.y).toBeLessThanOrEqual(90);
  expect(progressBox!.width).toBeGreaterThanOrEqual(250);
  expect(progressBox!.width).toBeLessThanOrEqual(270);
  expect(firstSummaryBox).not.toBeNull();
  expect(firstSummaryBox!.x).toBeGreaterThanOrEqual(44);
  expect(firstSummaryBox!.x).toBeLessThanOrEqual(48);
  expect(firstSummaryBox!.x + firstSummaryBox!.width).toBeGreaterThanOrEqual(738);
  expect(firstSummaryBox!.y).toBeGreaterThanOrEqual(445);
  expect(firstSummaryBox!.y).toBeLessThanOrEqual(470);
  const theoryTableBox = await page.locator('.syn-table-scroll').boundingBox();
  expect(theoryTableBox).not.toBeNull();
  expect(theoryTableBox!.height).toBeLessThanOrEqual(125);
  await expectSingleEditor(page);
  await expect(page).toHaveScreenshot('single-active-ordering-approved.png', {
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.1,
  });
  await expect(page).toHaveScreenshot('single-active-ordering-wide.png', {
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
  });

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
  expect(compactTitleBox).not.toBeNull();
  expect(compactTitleBox!.height).toBeLessThanOrEqual(120);
  await expect(page.getByTestId('workspace-assistant')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Hỏi AI về bài tập đang làm' })).toBeVisible();
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

test('keeps contextual AI zero-footprint across source, selection, item, and mobile flows', async ({
  page,
}) => {
  await prepareCanonicalOrderingState(page);

  await expect(page.getByTestId('workspace-assistant')).toHaveCount(0);
  const before = await workspaceGeometry(page);
  const practiceTrigger = page.getByRole('button', { name: 'Hỏi AI về bài tập đang làm' });
  await practiceTrigger.click();
  const quick = page.getByTestId('assistant-quick-popover');
  await expect(quick).toBeVisible();
  await expect(quick).toContainText('Bài tập · Sắp xếp thuật toán');
  expect(await workspaceGeometry(page)).toEqual(before);

  await quick.getByRole('button', { name: 'Mở cuộc hội thoại đầy đủ' }).click();
  const expanded = page.getByTestId('assistant-expanded-panel');
  await expect(expanded).toBeVisible();
  expect(await workspaceGeometry(page)).toEqual(before);
  await expect(page.getByRole('navigation', { name: 'Danh sách hoạt động' })).toBeAttached();
  await page.keyboard.press('Escape');
  await expect(expanded).toHaveCount(0);
  await expect(practiceTrigger).toBeFocused();

  const theoryParagraph = page.locator('[data-theory-reading-column] p').first();
  await theoryParagraph.selectText();
  const selectionToolbar = page.getByTestId('assistant-selection-toolbar');
  await expect(selectionToolbar).toBeVisible();
  await selectionToolbar
    .getByRole('button', { name: 'Hỏi AI về đoạn lý thuyết đã chọn' })
    .click();
  await expect(quick).toBeVisible();
  await expect(quick).toContainText('Đoạn được chọn');
  await page.keyboard.press('Escape');

  await page.locator('.syn-app-header__brand').selectText();
  await expect(selectionToolbar).toHaveCount(0);

  const orderingLabels = page.locator('.syn-activity-ordering__label');
  const labelsBefore = await orderingLabels.allTextContents();
  await page.getByRole('button', { name: 'Hỏi AI về bước Hiển thị kết quả' }).click();
  await expect(quick).toBeVisible();
  await expect(quick).toContainText('Bước được chọn · Sắp xếp thuật toán');
  await expect(quick).toContainText('Hiển thị kết quả');
  expect(await orderingLabels.allTextContents()).toEqual(labelsBefore);
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 390, height: 844 });
  const mobilePractice = page.getByRole('dialog', { name: /Sắp xếp thuật toán/ });
  await expect(mobilePractice).toBeVisible();
  const mobileLabelsBefore = await orderingLabels.allTextContents();
  const mobileTrigger = mobilePractice.getByRole('button', {
    name: 'Hỏi AI về bài tập đang làm',
  });
  await mobileTrigger.click();
  await expect(quick).toBeVisible();
  const mobileQuickBox = await requiredBox(quick);
  expect(Math.abs(mobileQuickBox.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(mobileQuickBox.x + mobileQuickBox.width - 390)).toBeLessThanOrEqual(1);
  expect(Math.abs(mobileQuickBox.y + mobileQuickBox.height - 844)).toBeLessThanOrEqual(2);

  await quick.getByRole('button', { name: 'Mở cuộc hội thoại đầy đủ' }).click();
  const mobileAssistant = page.getByRole('dialog', { name: 'Trợ lý AI' });
  await expect(mobileAssistant).toHaveAttribute('aria-modal', 'true');
  const mobileAssistantBox = await requiredBox(mobileAssistant);
  expect(Math.abs(mobileAssistantBox.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(mobileAssistantBox.y)).toBeLessThanOrEqual(1);
  expect(mobileAssistantBox.width).toBeLessThanOrEqual(391);
  expect(mobileAssistantBox.height).toBeLessThanOrEqual(845);
  await page.keyboard.press('Escape');
  await expect(mobileAssistant).toHaveCount(0);
  await expect(mobileTrigger).toBeFocused();
  expect(await orderingLabels.allTextContents()).toEqual(mobileLabelsBefore);
});
