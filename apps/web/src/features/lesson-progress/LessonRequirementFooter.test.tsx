import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  CourseNavigationPayload,
  LessonViewContext,
  NextActionPayload,
} from '@synaploom/protocol';
import { LessonRequirementFooter } from './LessonRequirementFooter';

const navigation: CourseNavigationPayload = {
  courseId: 'perf',
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
      title: 'Runtime',
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
      assessments: [],
    },
  ],
};

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
    currentLessonId: 'event-loop',
    returnTarget: null,
    nextAction,
  };
}

describe('LessonRequirementFooter', () => {
  it('renders destination-specific forward language for current progression targets', () => {
    render(
      <LessonRequirementFooter
        context={contextWithAction({
          type: 'RETURN_TO_CURRENT_LESSON',
          chapterId: 'runtime',
          lessonId: 'event-loop',
        })}
        navigation={navigation}
        onAction={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Tiếp tục bài Event Loop' })).toBeVisible();
    expect(screen.queryByText(/Quay lại/)).not.toBeInTheDocument();
  });

  it('renders learner-facing requirement copy instead of internal identifiers', () => {
    render(
      <LessonRequirementFooter
        context={{
          ...contextWithAction({ type: 'NONE' }),
          requirements: [
            {
              id: 'reading',
              kind: 'reading',
              required: true,
              satisfied: true,
              attempted: true,
              latestPassed: null,
            },
            {
              id: 'event-loop-order',
              kind: 'practice',
              required: true,
              satisfied: true,
              attempted: true,
              latestPassed: true,
            },
          ],
        }}
        navigation={navigation}
        onAction={vi.fn()}
      />,
    );

    expect(screen.getByText('Đọc nội dung bài học')).toBeVisible();
    expect(screen.getByText('Hoàn thành bài thực hành “Event Loop Order”')).toBeVisible();
    expect(screen.queryByText(/event-loop-order/)).not.toBeInTheDocument();
    expect(screen.queryByText(/· Bắt buộc/)).not.toBeInTheDocument();
  });

  it('renders course completion as status text without a fake summary button', () => {
    render(
      <LessonRequirementFooter
        context={contextWithAction({ type: 'VIEW_COURSE_SUMMARY', courseId: 'perf' })}
        navigation={navigation}
        onAction={vi.fn()}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Bạn đã hoàn thành khóa học');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
