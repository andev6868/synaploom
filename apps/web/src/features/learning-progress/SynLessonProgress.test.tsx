import type { CourseNavigationPayload } from '@synaploom/protocol';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SynLessonProgress } from './SynLessonProgress';

const readingBlocker = {
  id: 'reading',
  kind: 'reading' as const,
  required: true,
  satisfied: false,
  attempted: false,
  latestPassed: null,
};

const navigation: CourseNavigationPayload = {
  courseId: 'perf',
  currentLessonId: 'long-tasks',
  viewedItemId: 'event-loop',
  viewMode: 'REVIEW',
  returnTarget: {
    type: 'LESSON',
    id: 'long-tasks',
    chapterId: 'runtime',
    label: 'Quay lại bài đang học',
  },
  nextAction: { type: 'RETURN_TO_CURRENT_LESSON', chapterId: 'runtime', lessonId: 'long-tasks' },
  chapters: [
    {
      id: 'runtime',
      title: 'Runtime',
      status: 'IN_PROGRESS',
      required: true,
      lessons: [
        {
          id: 'event-loop',
          title: 'Event Loop',
          status: 'COMPLETED',
          required: true,
          current: false,
          viewed: true,
          blockingRequirements: [],
        },
        {
          id: 'long-tasks',
          title: 'Long Tasks',
          status: 'LOCKED',
          required: true,
          current: true,
          viewed: false,
          blockingRequirements: [readingBlocker],
        },
      ],
      assessments: [
        {
          id: 'runtime-capstone',
          title: 'Runtime Capstone',
          status: 'AVAILABLE',
          required: true,
          viewed: false,
          blockingRequirements: [],
        },
      ],
    },
  ],
};

function renderNavigator() {
  const onOpenLesson = vi.fn();
  const onOpenAssessment = vi.fn();
  const onLockedItem = vi.fn();
  render(
    <SynLessonProgress
      navigation={navigation}
      viewedItemId="event-loop"
      onOpenLesson={onOpenLesson}
      onOpenAssessment={onOpenAssessment}
      onLockedItem={onLockedItem}
    />,
  );
  return { onOpenLesson, onOpenAssessment, onLockedItem };
}

describe('SynLessonProgress', () => {
  it('allows a completed lesson to be opened in review mode', () => {
    const { onOpenLesson } = renderNavigator();

    fireEvent.click(
      screen.getByRole('button', { name: /Event Loop.*Đã hoàn thành.*Đang xem lại/i }),
    );

    expect(onOpenLesson).toHaveBeenCalledWith('runtime', 'event-loop');
  });

  it('does not navigate locked lessons and exposes blocking requirements', () => {
    const { onOpenLesson, onLockedItem } = renderNavigator();

    fireEvent.click(screen.getByRole('button', { name: /Long Tasks.*Bị khóa/i }));

    expect(onOpenLesson).not.toHaveBeenCalled();
    expect(onLockedItem).toHaveBeenCalledWith([readingBlocker]);
  });

  it('renders chapter assessments as distinct first-class items', () => {
    const { onOpenAssessment } = renderNavigator();

    fireEvent.click(
      screen.getByRole('button', {
        name: /Đánh giá chương.*Runtime Capstone.*Bắt buộc.*Có thể học/i,
      }),
    );

    expect(onOpenAssessment).toHaveBeenCalledWith('runtime', 'runtime-capstone');
  });

  it('renders chapter status and optionality inside the controlled drawer body', () => {
    renderNavigator();

    expect(screen.getByRole('heading', { name: 'Runtime' })).toBeVisible();
    expect(screen.getByText('Đang học')).toBeVisible();
    expect(screen.getByRole('button', { name: /Event Loop.*Bắt buộc/i })).toBeVisible();
  });
});
