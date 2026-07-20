import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const documents = [
  'docs/authoring/dual-surface-workspace.md',
  'docs/migrations/workspace-presentation-v1.md',
  'docs/testing/dual-surface-workspace-manual-verification.md',
] as const;

async function text(path: string): Promise<string> {
  return readFile(path, 'utf8');
}

void test('documents Dual-Surface Learning Workspace authoring and persistence semantics', async () => {
  for (const path of documents) {
    const content = await text(path);
    assert.ok(content.length > 500, `${path} is unexpectedly short`);
    assert.doesNotMatch(content, /\b(?:TBD|TODO|implement later)\b/i, `${path} has placeholders`);
  }

  const combined = (await Promise.all(documents.map(text))).join('\n');
  for (const concept of [
    'Dual-Surface Learning Workspace',
    'focusedActivityId',
    'userCollapsed',
    'save-before-switch',
    'WORKSPACE_PRESENTATION_CONFLICT',
    'allowInline',
    'allowPractice',
    'preferredWidth',
    'supportsFullscreen',
  ]) {
    assert.match(combined, new RegExp(concept), `missing ${concept}`);
  }
});

void test('publishes a complete manual verification matrix', async () => {
  const manual = await text('docs/testing/dual-surface-workspace-manual-verification.md');
  for (const scenario of [
    'refresh',
    'runtime restart',
    'lesson',
    'assessment',
    'mobile',
    'keyboard',
    'save failure',
    'conflict recovery',
  ]) {
    assert.match(manual, new RegExp(scenario, 'i'), `missing ${scenario} verification`);
  }
});

void test('registers the workspace documentation release gate', async () => {
  const packageJson = JSON.parse(await text('package.json')) as {
    scripts?: Record<string, string>;
  };
  assert.equal(
    packageJson.scripts?.['test:workspace-presentation-docs'],
    'node --experimental-strip-types --test tests/workspace-presentation-docs.spec.ts',
  );
});

void test('keeps practice error feedback bounded without pushing actions out of the footer', async () => {
  const css = await text('apps/web/src/application.css');
  assert.match(css, /\.syn-practice-workspace-card__footer-status\s*\{[^}]*min-width:\s*0;/s);
  assert.match(css, /\.syn-practice-pane__feedback\s*\{[^}]*min-width:\s*0;/s);
  assert.match(css, /\.syn-practice-pane__feedback p\s*\{[^}]*overflow-wrap:\s*anywhere;/s);
  assert.match(css, /\.syn-practice-pane__feedback \.syn-button\s*\{[^}]*flex:\s*none;/s);
});

void test('keeps the lower theory content compact and includes single-activity guidance', async () => {
  const css = await text('apps/web/src/application.css');
  const lesson = await text(
    'examples/multi-domain-foundations/lessons/01-algorithm-flow/lesson.md',
  );

  assert.match(
    css,
    /\.syn-lesson-panel__article > \.syn-prose > \.syn-lesson-callout\s*\{[^}]*margin:\s*0\.35rem 0 0\.65rem;/s,
  );
  assert.match(css, /\.syn-requirement-footer\s*\{[^}]*margin-top:\s*0\.75rem;/s);
  assert.match(lesson, /Chỉ 1 hoạt động mở tại một thời điểm\./);
});
