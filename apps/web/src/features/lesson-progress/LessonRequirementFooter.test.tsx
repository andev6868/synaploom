import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LessonViewContext, NextActionPayload } from '@synaploom/protocol';
import { LessonRequirementFooter } from './LessonRequirementFooter';

function contextWithAction(nextAction: NextActionPayload): LessonViewContext {
  return {
    chapterId: 'runtime',
    status: 'IN_PROGRESS',
    required: true,
    readingCompleted: false,
    requirements: [
      {
        id: 'reading',
        kind: 'reading',
        required: true,
        satisfied: false,
        attempted: false,
        latestPassed: null,
      },
    ],
    viewMode: 'LEARNING',
    currentLessonId: 'main-thread',
    returnTarget: null,
    nextAction,
  };
}

describe('LessonRequirementFooter', () => {
  it.each([
    [
      { type: 'ACKNOWLEDGE_READING', chapterId: 'runtime', lessonId: 'main-thread' },
      'Hoàn thành bài học',
    ],
    [
      {
        type: 'START_REQUIRED_PRACTICE',
        chapterId: 'runtime',
        lessonId: 'main-thread',
        practiceId: 'check',
      },
      'Đi đến bài thực hành',
    ],
    [
      {
        type: 'RETRY_REQUIRED_PRACTICE',
        chapterId: 'runtime',
        lessonId: 'main-thread',
        practiceId: 'check',
      },
      'Thử lại bài thực hành',
    ],
    [
      { type: 'CONTINUE_TO_LESSON', chapterId: 'runtime', lessonId: 'event-loop' },
      'Tiếp tục bài tiếp theo',
    ],
    [
      { type: 'START_CHAPTER_ASSESSMENT', chapterId: 'runtime', assessmentId: 'capstone' },
      'Bắt đầu thực hành của chương',
    ],
    [{ type: 'CONTINUE_TO_CHAPTER', chapterId: 'rendering' }, 'Tiếp tục chương tiếp theo'],
    [
      { type: 'RETURN_TO_CURRENT_LESSON', chapterId: 'runtime', lessonId: 'main-thread' },
      'Quay lại bài đang học',
    ],
    [{ type: 'VIEW_COURSE_SUMMARY', courseId: 'perf' }, 'Xem tổng kết khóa học'],
  ] as const)('maps next action to its primary CTA', (nextAction, label) => {
    render(<LessonRequirementFooter context={contextWithAction(nextAction)} onAction={vi.fn()} />);
    expect(screen.getByRole('button', { name: label })).toBeVisible();
  });
});
