import { test } from 'vitest';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadCourse } from '#src/index';

test('loads a validated immutable course in canonical order', async () => {
  const course = await loadCourse(path.resolve('tests/fixtures/valid-course'));
  assert.deepEqual(
    course.lessons.map((lesson) => lesson.position),
    [1],
  );
  assert.deepEqual(course.lessons[0]?.blocks, []);
  assert.equal(Object.isFrozen(course), true);
  assert.equal(Object.isFrozen(course.lessons), true);
});
