import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  COURSE_SCHEMA_VERSION,
  type CourseManifest,
  type ActivityDefinition,
  type LessonStatus,
  type ProcessEvent,
} from '#src/index';

test('represents course and runtime contracts', () => {
  const course: CourseManifest = {
    schemaVersion: '1.0',
    id: 'demo',
    title: 'Demo',
    description: 'Demo course',
    version: '1.0.0',
    language: 'vi',
    lessons: [{ id: 'intro', position: 1, path: 'lessons/01-intro' }],
  };
  const activity: ActivityDefinition = {
    schemaVersion: '1.0',
    id: 'question',
    kind: 'true-false',
    title: 'Question',
    prompt: { blocks: [] },
    config: { expected: true },
    evaluation: { mode: 'automatic', points: 1 },
    completion: { required: true },
  };
  const status: LessonStatus = 'AVAILABLE';
  const event: ProcessEvent = {
    type: 'process.started',
    sessionId: 's1',
    lessonId: 'intro',
    timestamp: new Date(0).toISOString(),
  };
  assert.equal(COURSE_SCHEMA_VERSION, '1.0');
  assert.equal(course.lessons?.length, 1);
  assert.equal(activity.kind, 'true-false');
  assert.equal(status, 'AVAILABLE');
  assert.equal(event.type, 'process.started');
});
