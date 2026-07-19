import { expect, test, type Locator, type Page } from '@playwright/test';
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

async function isVisible(locator: Locator): Promise<boolean> {
  return locator.isVisible().catch(() => false);
}

async function openActivity(page: Page, title: string): Promise<Locator> {
  const practice = page.getByRole('region', { name: 'Khu vực thực hành' });
  const practiceHeading = practice.locator('h2[data-workspace-activity-heading="true"]', { hasText: title });
  if (await isVisible(practiceHeading)) {
    return practice;
  }

  const inline = page.locator('[data-activity-id]').filter({ hasText: title }).first();
  const inlineFieldset = inline.locator('fieldset').filter({
    has: inline.locator('legend', { hasText: title }),
  });
  if (await isVisible(inlineFieldset)) {
    return inlineFieldset;
  }

  const open = inline
    .getByRole('button', {
      name: /Thực hành bài này|Quay lại thực hành|Mở lại thực hành/,
    })
    .first();
  await expect(open).toBeVisible();
  await open.click();
  await expect(practiceHeading).toBeVisible();
  return practice;
}

async function submit(scope: Locator, label = 'Kiểm tra đáp án'): Promise<void> {
  await scope.getByRole('button', { name: label }).click();
  const nestedHost = scope.locator('.syn-activity-host').first();
  const host =
    (await nestedHost.count()) > 0
      ? nestedHost
      : scope
          .locator(
            'xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " syn-activity-host ")]',
          )
          .first();
  await expect(host).toHaveAttribute('data-state', 'evaluated');
}

async function acknowledgeAndContinue(
  page: Page,
  nextLabel: RegExp,
  expectedHeading: string,
): Promise<void> {
  await page.getByRole('button', { name: 'Đánh dấu đã đọc' }).click();
  const next = page.getByRole('button', { name: nextLabel });
  await expect(next).toBeVisible({ timeout: 10_000 });
  await next.click();
  await expect(page.getByRole('heading', { name: expectedHeading })).toBeVisible({
    timeout: 10_000,
  });
}

test.beforeAll(async () => {
  home = await mkdtemp(path.join(tmpdir(), 'synaploom-multi-domain-e2e-'));
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

test('completes all Activity Engine v1 kinds across five domains and one assessment', async ({
  page,
}) => {
  await page.goto(bootstrap);
  await expect(page.getByRole('heading', { name: 'Dòng chảy thuật toán' })).toBeVisible();

  const ordering = await openActivity(page, 'Sắp xếp thuật toán');
  await ordering.getByRole('button', { name: /Di chuyển Đọc hai số a và b xuống/ }).click();
  await ordering.getByRole('button', { name: /Di chuyển Đọc hai số a và b lên/ }).click();
  await submit(ordering);

  const coding = await openActivity(page, 'Viết chương trình tính tổng');
  const codeEditor = coding.getByRole('textbox', { name: 'Trình soạn thảo mã' });
  await expect(codeEditor).toHaveValue(/return 0/);
  await codeEditor.fill('function sum(a, b) {\n  return a + b;\n}\n\nconsole.log(sum(2, 3));\n');
  await coding.getByRole('button', { name: 'Lưu', exact: true }).click();
  await coding.getByRole('button', { name: 'Kiểm tra kết quả' }).click();
  await expect(page.getByText('Đã kết thúc')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Kết quả kiểm tra' }).getByText('Đạt', { exact: true }),
  ).toBeVisible();
  await acknowledgeAndContinue(page, /Tiếp tục bài/, 'Suy luận đại số');

  const numeric = await openActivity(page, 'Giải phương trình');
  await numeric.getByRole('textbox', { name: 'Giá trị hoặc biểu thức' }).fill('4');
  await submit(numeric);
  const truth = await openActivity(page, 'Kiểm tra mệnh đề');
  await truth.getByRole('radio', { name: 'Đúng' }).check();
  await submit(truth);
  await acknowledgeAndContinue(page, /Tiếp tục bài/, 'Giao tiếp hằng ngày');

  const blanks = await openActivity(page, 'Hoàn thành lời chào');
  await blanks.getByRole('textbox', { name: '___, how are you?' }).fill('Hello');
  await submit(blanks);
  const matching = await openActivity(page, 'Ghép từ với nghĩa');
  await matching.getByRole('combobox', { name: 'Ghép với book' }).selectOption('sach');
  await matching.getByRole('combobox', { name: 'Ghép với learn' }).selectOption('hoc');
  await submit(matching);
  await acknowledgeAndContinue(page, /Tiếp tục bài/, 'Đọc và dùng dẫn chứng');

  const shortAnswer = await openActivity(page, 'Nhận diện hình ảnh');
  await shortAnswer.getByRole('textbox', { name: 'Câu trả lời' }).fill('hòn lửa');
  await submit(shortAnswer);
  const writing = await openActivity(page, 'Viết đoạn phân tích');
  await writing
    .getByRole('textbox', { name: 'Bài viết' })
    .fill('Hình ảnh hòn lửa làm cảnh hoàng hôn trên biển trở nên rực rỡ và giàu sức gợi.');
  await submit(writing, 'Nộp bài viết');
  await acknowledgeAndContinue(page, /Tiếp tục bài/, 'Bằng chứng và thời gian');

  const single = await openActivity(page, 'Chu trình nước');
  await single.getByRole('radio', { name: 'Bay hơi' }).check();
  await submit(single);
  const multiple = await openActivity(page, 'Đánh giá nguồn sử liệu');
  await multiple.getByRole('checkbox', { name: /Lá thư/ }).check();
  await multiple.getByRole('checkbox', { name: /Ảnh chụp/ }).check();
  await submit(multiple);
  await page.getByRole('button', { name: 'Đánh dấu đã đọc' }).click();
  await page.getByRole('button', { name: /Bắt đầu đánh giá Đánh giá tổng hợp/ }).click();

  const checkpointChoice = await openActivity(page, 'Chọn chiến lược học');
  await checkpointChoice.getByRole('radio', { name: 'Tự giải thích bằng lời của mình' }).check();
  await submit(checkpointChoice);
  const checkpointNumber = await openActivity(page, 'Tính nhanh');
  await checkpointNumber.getByRole('textbox', { name: 'Giá trị hoặc biểu thức' }).fill('80');
  await submit(checkpointNumber);
  await expect(page.getByText('Bạn đã hoàn thành khóa học')).toBeVisible();
});
