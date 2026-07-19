import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
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

test('validates Course Schema 1.2 activity sets and rejects scored submission-only writing', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'synaploom-activity-course-'));
  await mkdir(path.join(root, 'lessons', '01-writing', 'activities'), { recursive: true });
  await writeFile(
    path.join(root, 'course.json'),
    JSON.stringify({
      schemaVersion: '1.2.0',
      id: 'writing-course',
      title: 'Writing Course',
      description: 'Writing',
      version: '1.2.0',
      language: 'en',
      chapters: [
        {
          id: 'writing',
          title: 'Writing',
          required: true,
          lessons: [{ id: 'essay', required: true }],
          assessments: [],
        },
      ],
    }),
  );
  await writeFile(
    path.join(root, 'lessons', '01-writing', 'lesson.md'),
    `---
id: essay
title: Essay
position: 1
type: theory
activitySets:
  - activities/practice.json
---
Write.
`,
  );
  await writeFile(
    path.join(root, 'lessons', '01-writing', 'activities', 'practice.json'),
    JSON.stringify({
      schemaVersion: '1.0',
      id: 'practice',
      policy: {
        purpose: 'practice',
        maxAttempts: null,
        feedbackMode: 'immediate',
        revealAnswers: 'never',
        scoring: 'none',
        passingScore: null,
      },
      activities: [{ id: 'reflection', path: 'reflection.activity.json', required: true }],
    }),
  );
  await writeFile(
    path.join(root, 'lessons', '01-writing', 'activities', 'reflection.activity.json'),
    JSON.stringify({
      schemaVersion: '1.0',
      id: 'reflection',
      kind: 'writing',
      title: 'Reflection',
      prompt: { blocks: [] },
      config: { minimumCharacters: 1, maximumCharacters: 500, answerFormat: 'plain-text' },
      evaluation: { mode: 'submission', points: 0 },
      completion: { required: true },
    }),
  );

  const valid = await validateCoursePackage(root);
  assert.equal(valid.valid, true, JSON.stringify(valid.issues));

  const setPath = path.join(root, 'lessons', '01-writing', 'activities', 'practice.json');
  const scoredSet = JSON.parse(
    await import('node:fs/promises').then(({ readFile }) => readFile(setPath, 'utf8')),
  );
  scoredSet.policy = {
    ...scoredSet.policy,
    purpose: 'assessment',
    scoring: 'points',
    passingScore: 1,
  };
  await writeFile(setPath, JSON.stringify(scoredSet));
  const invalid = await validateCoursePackage(root);
  assert.equal(invalid.valid, false);
  assert.ok(
    invalid.issues.some((issue) => issue.code === 'ASSESSMENT_SCORE_REQUIRES_SCORABLE_ACTIVITY'),
  );
});

test('rejects impossible activity presentation policies', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'synaploom-presentation-course-'));
  await mkdir(path.join(root, 'lessons', '01-quiz', 'activities'), { recursive: true });
  await writeFile(
    path.join(root, 'course.json'),
    JSON.stringify({
      schemaVersion: '1.2.0',
      id: 'presentation-course',
      title: 'Presentation Course',
      description: 'Presentation',
      version: '1.0.0',
      language: 'en',
      chapters: [
        {
          id: 'quiz',
          title: 'Quiz',
          required: true,
          lessons: [{ id: 'quiz', required: true }],
          assessments: [],
        },
      ],
    }),
  );
  await writeFile(
    path.join(root, 'lessons', '01-quiz', 'lesson.md'),
    `---\nid: quiz\ntitle: Quiz\nposition: 1\ntype: theory\nactivitySets:\n  - activities/practice.json\n---\nQuiz.\n`,
  );
  await writeFile(
    path.join(root, 'lessons', '01-quiz', 'activities', 'practice.json'),
    JSON.stringify({
      schemaVersion: '1.0',
      id: 'practice',
      policy: {
        purpose: 'practice',
        maxAttempts: null,
        feedbackMode: 'immediate',
        revealAnswers: 'never',
        scoring: 'none',
        passingScore: null,
      },
      activities: [{ id: 'quiz', path: 'quiz.activity.json', required: true }],
    }),
  );
  await writeFile(
    path.join(root, 'lessons', '01-quiz', 'activities', 'quiz.activity.json'),
    JSON.stringify({
      schemaVersion: '1.0',
      id: 'quiz',
      kind: 'true-false',
      title: 'Quiz',
      prompt: { blocks: [] },
      config: { expected: true },
      evaluation: { mode: 'automatic', points: 1 },
      completion: { required: true },
      presentation: {
        defaultSurface: 'inline',
        allowInline: false,
        allowPractice: true,
        preferredWidth: 'compact',
        supportsFullscreen: false,
      },
    }),
  );
  const report = await validateCoursePackage(root);
  assert.equal(report.valid, false);
  assert.ok(report.issues.some((issue) => issue.code === 'ACTIVITY_PRESENTATION_INVALID'));
});
