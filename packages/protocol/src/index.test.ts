import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  isApiErrorPayload,
  parseLessonViewContext,
  type CoursePayload,
  type LessonPayload,
  type ActivityStatusPayload,
  type ApiErrorDetails,
  type UpdateWorkspacePresentationPayload,
  type WorkspacePresentationState,
} from '#src/index';

describe('local protocol contracts', () => {
  it('models daemon-authoritative payloads', () => {
    const course: CoursePayload = {
      id: 'frontend-performance-foundations',
      title: 'Frontend Performance Foundations',
      description: 'Local course',
      version: '1.0.0',
      currentLessonId: 'main-thread',
      completedAt: null,
      lessons: [],
    };
    const lesson: LessonPayload = {
      id: 'main-thread',
      title: 'Main Thread',
      position: 1,
      type: 'theory',
      estimatedMinutes: 12,
      blocks: [{ type: 'heading', level: 1, text: 'Main Thread' }],
      status: 'AVAILABLE',
      readingAcknowledged: false,
      latestCheck: null,
      exercise: null,
    };
    expect(course.currentLessonId).toBe('main-thread');
    expect(lesson.blocks[0]?.type).toBe('heading');
    expect(isApiErrorPayload({ code: 'LESSON_LOCKED', message: 'locked' })).toBe(true);
  });

  it('accepts a review lesson context with a return target', () => {
    expect(
      parseLessonViewContext({
        chapterId: 'runtime',
        status: 'COMPLETED',
        required: true,
        readingCompleted: true,
        requirements: [],
        viewMode: 'REVIEW',
        currentLessonId: 'rendering',
        returnTarget: {
          type: 'LESSON',
          chapterId: 'runtime',
          id: 'rendering',
          label: 'Quay lại bài đang học',
        },
        nextAction: {
          type: 'RETURN_TO_CURRENT_LESSON',
          chapterId: 'runtime',
          lessonId: 'rendering',
        },
      }),
    ).toMatchObject({ viewMode: 'REVIEW' });
  });
});

it('generates protocol types from canonical schemas', () => {
  const generated = readFileSync('generated/typescript/index.ts', 'utf8');
  expect(generated).toContain('export interface CoursePayload');
  expect(generated).toContain('export type ProcessEvent');
  expect(generated).toContain('Generated from schemas/v1');
});

it('exposes owner-scoped workspace presentation protocol', () => {
  const update: UpdateWorkspacePresentationPayload = {
    focusedActivityId: 'event-loop-lab',
    paneMode: 'split',
    splitRatio: 0.45,
    userCollapsed: false,
    revision: 2,
  };
  const state: WorkspacePresentationState = {
    courseId: 'frontend-performance-foundations',
    ownerKind: 'lessons',
    ownerId: 'event-loop',
    updatedAt: '2026-07-19T00:00:00Z',
    ...update,
  };
  const status: ActivityStatusPayload = {
    activityId: 'event-loop-lab',
    status: 'DRAFT',
    attemptNumber: 1,
    score: null,
    maxScore: null,
    passed: null,
  };
  const errorDetails: ApiErrorDetails = {
    currentWorkspacePresentation: state,
    diagnostic: 'stale revision',
  };
  expect(state.revision).toBe(2);
  expect(status.status).toBe('DRAFT');
  expect(errorDetails.currentWorkspacePresentation?.ownerId).toBe('event-loop');
});
