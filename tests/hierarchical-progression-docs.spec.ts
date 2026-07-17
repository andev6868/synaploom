import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const files = [
  'README.md',
  'docs/course-authoring/course-format-v1.md',
  'docs/architecture/go-core.md',
  'docs/architecture/decisions/0003-hierarchical-progression.md',
  'docs/user/getting-started.md',
];

describe('hierarchical progression documentation', () => {
  it('documents the normative migration and progression concepts', async () => {
    const text = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
    for (const concept of [
      'schemaVersion 1.1.0',
      'required and optional lessons',
      'chapter assessments',
      'bestResult and latestResult',
      'currentLessonId and viewedLessonId',
      'review mode does not rollback progression',
      'Course Schema 1.0 implicit chapter migration',
    ])
      expect(text).toContain(concept);
  });
});
