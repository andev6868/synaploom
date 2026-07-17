import { test } from 'vitest';
import assert from 'node:assert/strict';
import path from 'node:path';
import { validateCoursePackage } from '#src/index';

const fixtures = path.resolve('tests/fixtures');

test('accepts a contiguous valid course', async () => {
  const report = await validateCoursePackage(path.join(fixtures, 'valid-course'));
  assert.equal(report.valid, true, JSON.stringify(report.issues));
});

test('rejects path traversal references', async () => {
  const report = await validateCoursePackage(path.join(fixtures, 'path-traversal-course'));
  assert.equal(report.valid, false);
  assert.ok(report.issues.some((issue) => issue.code === 'PATH_OUTSIDE_ROOT'));
});

test('rejects non-contiguous positions', async () => {
  const root = path.join(fixtures, 'valid-course');
  const report = await validateCoursePackage(root, {
    manifestOverride: {
      schemaVersion: '1.0',
      id: 'x',
      title: 'X',
      description: 'X',
      version: '1.0.0',
      language: 'vi',
      lessons: [{ id: 'intro', position: 2, path: 'lessons/01-intro' }],
    },
  });
  assert.equal(report.valid, false);
  assert.ok(report.issues.some((issue) => issue.code === 'LESSON_POSITION_INVALID'));
});
