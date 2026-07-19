import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const documents = [
  'docs/authoring/rich-lesson-content.md',
  'docs/authoring/activity-engine.md',
  'docs/authoring/activity-kinds.md',
  'docs/migrations/course-schema-1.2.md',
  'docs/security/activity-engine-boundaries.md',
  'docs/testing/activity-engine-manual-verification.md',
] as const;

async function text(path: string): Promise<string> {
  return readFile(path, 'utf8');
}

void test('publishes complete Activity Engine authoring and operations documentation', async () => {
  for (const path of documents) {
    const content = await text(path);
    assert.ok(content.length > 500, `${path} is unexpectedly short`);
    assert.doesNotMatch(content, /\b(?:TBD|TODO|implement later)\b/i, `${path} has placeholders`);
  }

  const kinds = await text('docs/authoring/activity-kinds.md');
  for (const kind of [
    'single-choice',
    'multiple-choice',
    'true-false',
    'short-answer',
    'fill-blanks',
    'ordering',
    'matching',
    'numeric',
    'writing',
    'coding',
  ]) {
    assert.match(kinds, new RegExp(`\\b${kind}\\b`), `missing ${kind}`);
  }
});

void test('advertises Course Schema 1.2 and runs Activity Engine release gates', async () => {
  const buildInfo = await text('internal/buildinfo/buildinfo.go');
  assert.match(buildInfo, /SchemaVersion\s*=\s*"1\.2\.0"/);

  const packageJson = JSON.parse(await text('package.json')) as {
    scripts?: Record<string, string>;
  };
  assert.match(packageJson.scripts?.['validate:multi-domain'] ?? '', /multi-domain-foundations/);
  assert.match(packageJson.scripts?.['test:activity-engine'] ?? '', /internal\/activity/);

  const workflow = await text('.github/workflows/go-release.yml');
  assert.match(workflow, /pnpm validate:example/);
  assert.match(workflow, /pnpm validate:multi-domain/);
  assert.match(workflow, /pnpm test:activity-engine/);
  assert.match(workflow, /pnpm playwright test --project=go-runtime/);
  assert.match(workflow, /SYNAPLOOM_SCHEMA_VERSION:\s*'1\.2\.0'/);
});
