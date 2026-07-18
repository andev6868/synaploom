import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LearningTopNavigation } from '#src/features/learning-progress/LearningTopNavigation';

const navigation = {
  courseId: 'course',
  currentLessonId: 'lesson-1',
  viewedItemId: 'lesson-1',
  viewMode: 'LEARNING' as const,
  returnTarget: null,
  nextAction: { type: 'NONE' as const },
  chapters: [
    {
      id: 'chapter-1',
      title: 'Runtime',
      status: 'IN_PROGRESS' as const,
      required: true,
      lessons: [
        {
          id: 'lesson-1',
          title: 'Main Thread',
          status: 'COMPLETED' as const,
          required: true,
          current: false,
          viewed: true,
          blockingRequirements: [],
        },
        {
          id: 'lesson-2',
          title: 'Event Loop',
          status: 'IN_PROGRESS' as const,
          required: true,
          current: true,
          viewed: false,
          blockingRequirements: [],
        },
      ],
      assessments: [
        {
          id: 'assessment-1',
          title: 'Runtime Capstone',
          status: 'LOCKED' as const,
          required: true,
          viewed: false,
          blockingRequirements: [
            {
              kind: 'lesson' as const,
              id: 'lesson-2',
              required: true,
              satisfied: false,
              attempted: false,
              latestPassed: false,
            },
          ],
        },
      ],
    },
  ],
};

const navigationWithTwoChapters = {
  ...navigation,
  chapters: [
    ...navigation.chapters,
    {
      id: 'chapter-2',
      title: 'Rendering Fundamentals',
      status: 'AVAILABLE' as const,
      required: true,
      lessons: [
        {
          id: 'lesson-3',
          title: 'Rendering Fundamentals',
          status: 'AVAILABLE' as const,
          required: true,
          current: false,
          viewed: false,
          blockingRequirements: [],
        },
      ],
      assessments: [],
    },
  ],
};

describe('LearningTopNavigation', () => {
  it('renders step markers only for the viewed chapter while previous and next stay course-wide', () => {
    render(
      <LearningTopNavigation
        navigation={navigationWithTwoChapters}
        viewedItemId="lesson-1"
        onOpenLesson={vi.fn()}
        onOpenAssessment={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('1/3 mục trong chương đã hoàn thành')).toBeInTheDocument();
    expect(screen.getAllByTestId('chapter-step')).toHaveLength(3);
    expect(screen.queryByTitle('Rendering Fundamentals')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mục học tiếp theo' })).toBeEnabled();
  });

  it('keeps curriculum navigation in the header and explains locked items', () => {
    const openLesson = vi.fn();
    render(
      <LearningTopNavigation
        navigation={navigation}
        viewedItemId="lesson-1"
        onOpenLesson={openLesson}
        onOpenAssessment={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mục học tiếp theo' }));
    expect(openLesson).toHaveBeenCalledWith('chapter-1', 'lesson-2');

    fireEvent.click(screen.getByRole('button', { name: 'Nội dung' }));
    fireEvent.click(screen.getByRole('button', { name: /Runtime Capstone/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('Hoàn thành bài học lesson-2');
  });
});
