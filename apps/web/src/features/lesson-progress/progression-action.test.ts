import { describe, expect, it } from 'vitest';
import type { CourseNavigationPayload, NextActionPayload } from '@synaploom/protocol';
import { resolveProgressionAction } from './progression-action';

const navigation: CourseNavigationPayload = {
  courseId: 'frontend-performance-foundations',
  currentLessonId: 'event-loop',
  viewedItemId: 'main-thread',
  viewMode: 'REVIEW',
  returnTarget: {
    type: 'LESSON',
    id: 'event-loop',
    chapterId: 'runtime',
    label: 'Event Loop',
  },
  nextAction: {
    type: 'RETURN_TO_CURRENT_LESSON',
    chapterId: 'runtime',
    lessonId: 'event-loop',
  },
  chapters: [
    {
      id: 'runtime',
      title: 'JavaScript Runtime',
      status: 'IN_PROGRESS',
      required: true,
      lessons: [
        {
          id: 'main-thread',
          title: 'Main Thread',
          status: 'COMPLETED',
          required: true,
          current: false,
          viewed: true,
          blockingRequirements: [],
        },
        {
          id: 'event-loop',
          title: 'Event Loop',
          status: 'IN_PROGRESS',
          required: true,
          current: true,
          viewed: false,
          blockingRequirements: [],
        },
      ],
      assessments: [
        {
          id: 'runtime-checkpoint',
          title: 'Runtime Checkpoint',
          status: 'LOCKED',
          required: true,
          viewed: false,
          blockingRequirements: [],
        },
      ],
    },
    {
      id: 'rendering',
      title: 'Rendering Performance',
      status: 'LOCKED',
      required: true,
      lessons: [],
      assessments: [],
    },
  ],
};

function buttonLabel(action: NextActionPayload): string {
  const presentation = resolveProgressionAction(action, navigation);
  expect(presentation.kind).toBe('button');
  if (presentation.kind !== 'button') throw new Error('Expected button presentation.');
  return presentation.label;
}

describe('resolveProgressionAction', () => {
  it('describes returning to the current target as forward continuation', () => {
    expect(
      buttonLabel({
        type: 'RETURN_TO_CURRENT_LESSON',
        chapterId: 'runtime',
        lessonId: 'event-loop',
      }),
    ).toBe('Tiếp tục bài Event Loop');
  });

  it('uses the destination lesson title for continue actions', () => {
    expect(
      buttonLabel({ type: 'CONTINUE_TO_LESSON', chapterId: 'runtime', lessonId: 'event-loop' }),
    ).toBe('Tiếp tục bài Event Loop');
  });

  it('does not expose an unknown lesson identifier', () => {
    expect(
      buttonLabel({ type: 'CONTINUE_TO_LESSON', chapterId: 'runtime', lessonId: 'raw-id' }),
    ).toBe('Tiếp tục bài học');
  });

  it('uses learner-facing assessment and chapter titles', () => {
    expect(
      buttonLabel({
        type: 'START_CHAPTER_ASSESSMENT',
        chapterId: 'runtime',
        assessmentId: 'runtime-checkpoint',
      }),
    ).toBe('Bắt đầu đánh giá Runtime Checkpoint');
    expect(buttonLabel({ type: 'CONTINUE_TO_CHAPTER', chapterId: 'rendering' })).toBe(
      'Tiếp tục chương Rendering Performance',
    );
  });

  it('renders compatibility summary actions as a terminal status', () => {
    expect(
      resolveProgressionAction(
        { type: 'VIEW_COURSE_SUMMARY', courseId: 'frontend-performance-foundations' },
        navigation,
      ),
    ).toEqual({ kind: 'complete', message: 'Bạn đã hoàn thành khóa học' });
  });

  it('renders no presentation for NONE', () => {
    expect(resolveProgressionAction({ type: 'NONE' }, navigation)).toEqual({ kind: 'none' });
  });
});
