import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppProviders } from '#src/app/providers/AppProviders';
import { LearningWorkspacePage } from '#src/features/workspace-layout/LearningWorkspacePage';
import type { SynaploomApiClient } from '#src/shared/api/client';

const course = {
  id: 'frontend-performance-foundations',
  title: 'Frontend Performance Foundations',
  description: 'Course',
  version: '1.0.0',
  currentLessonId: 'main-thread',
  completedAt: null,
  lessons: [
    {
      id: 'main-thread',
      position: 1,
      title: 'Main Thread',
      type: 'theory' as const,
      estimatedMinutes: 10,
      status: 'AVAILABLE' as const,
    },
  ],
};
const lesson = {
  id: 'main-thread',
  title: 'Main Thread',
  position: 1,
  type: 'theory' as const,
  estimatedMinutes: 10,
  blocks: [{ type: 'heading' as const, level: 2 as const, text: 'Mục tiêu học tập' }],
  status: 'AVAILABLE' as const,
  readingAcknowledged: false,
  latestCheck: null,
  exercise: null,
};

const navigation = {
  courseId: course.id,
  currentLessonId: lesson.id,
  viewedItemId: lesson.id,
  viewMode: 'LEARNING' as const,
  returnTarget: null,
  nextAction: { type: 'NONE' as const },
  chapters: [
    {
      id: 'runtime-fundamentals',
      title: 'Runtime Fundamentals',
      status: 'IN_PROGRESS' as const,
      required: true,
      lessons: [
        {
          id: lesson.id,
          title: lesson.title,
          status: 'AVAILABLE' as const,
          required: true,
          current: true,
          viewed: true,
          blockingRequirements: [],
        },
      ],
      assessments: [],
    },
  ],
};

function fakeApi(): SynaploomApiClient {
  return {
    getNavigation: () => Promise.resolve(navigation),
    getLessonView: () => Promise.reject(new Error('not used')),
    getChapterAssessment: () => Promise.reject(new Error('not used')),
    recordChapterAssessment: () => Promise.reject(new Error('not used')),
    getCourse: () => Promise.resolve(course),
    getCurrentLesson: () => Promise.resolve(lesson),
    getLesson: () => Promise.resolve(lesson),
    startLesson: () => Promise.resolve(),
    acknowledgeReading: () => Promise.resolve(),
    completeLesson: () =>
      Promise.resolve({ completed: true, courseCompleted: true, nextLesson: null }),
    listFiles: () => Promise.resolve([]),
    readFile: () => Promise.resolve({ path: '', content: '' }),
    writeFile: () => Promise.resolve(),
    resetWorkspace: () => Promise.resolve(),
    runAction: () => Promise.resolve({ sessionId: 'session', eventsUrl: '/events' }),
    requestAi: () =>
      Promise.resolve({ status: 'disabled', message: 'AI assistance is not configured.' }),
    getPaneRatio: () => Promise.resolve(0.48),
    setPaneRatio: (ratio) => Promise.resolve(ratio),
  };
}

describe('LearningWorkspacePage', () => {
  it('renders the focused lesson and practice workspace from typed daemon data', async () => {
    render(
      <AppProviders api={fakeApi()}>
        <LearningWorkspacePage requestedLessonId={null} />
      </AppProviders>,
    );
    expect(await screen.findByRole('heading', { name: 'Main Thread', level: 1 })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Mục tiêu học tập' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Điều hướng khóa học' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Nội dung' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Hoàn thành phần đọc' })).toBeEnabled();
  });
});
