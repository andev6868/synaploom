import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppProviders } from '#src/app/providers/AppProviders';
import { LearningWorkspacePage } from '#src/features/workspace-layout/LearningWorkspacePage';
import type { CourseNavigationPayload } from '@synaploom/protocol';
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
  blocks: [
    {
      type: 'heading' as const,
      level: 2 as const,
      children: [{ type: 'text' as const, value: 'Mục tiêu học tập' }],
    },
  ],
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
    getActivity: () => Promise.reject(new Error('not used')),
    getCurrentActivityAttempt: () => Promise.resolve(null),
    saveActivityDraft: () => Promise.reject(new Error('not used')),
    submitActivityAttempt: () => Promise.reject(new Error('not used')),
    getActivitySetProgress: () => Promise.reject(new Error('not used')),
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
        <LearningWorkspacePage route={{ kind: 'lesson', lessonId: null }} />
      </AppProviders>,
    );
    expect(await screen.findByRole('heading', { name: 'Main Thread', level: 1 })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Mục tiêu học tập' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Điều hướng khóa học' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Nội dung' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Hoàn thành phần đọc' })).toBeEnabled();
  });

  it('uses a compact review status without breadcrumb or review banner', async () => {
    const reviewLesson = { ...lesson, status: 'COMPLETED' as const };
    const reviewNavigation = {
      ...navigation,
      currentLessonId: 'event-loop',
      viewedItemId: 'main-thread',
      viewMode: 'REVIEW' as const,
      returnTarget: {
        type: 'LESSON' as const,
        id: 'event-loop',
        chapterId: 'runtime-fundamentals',
        label: 'Event Loop',
      },
      nextAction: {
        type: 'RETURN_TO_CURRENT_LESSON' as const,
        chapterId: 'runtime-fundamentals',
        lessonId: 'event-loop',
      },
    };
    const api: SynaploomApiClient = {
      ...fakeApi(),
      getNavigation: () => Promise.resolve(reviewNavigation),
      getLessonView: () =>
        Promise.resolve({
          lesson: reviewLesson,
          context: {
            chapterId: 'runtime-fundamentals',
            status: 'COMPLETED' as const,
            required: true,
            readingCompleted: true,
            requirements: [],
            viewMode: 'REVIEW' as const,
            currentLessonId: 'event-loop',
            returnTarget: reviewNavigation.returnTarget,
            nextAction: reviewNavigation.nextAction,
          },
        }),
    };

    render(
      <AppProviders api={api}>
        <LearningWorkspacePage
          route={{
            kind: 'lesson',
            courseId: course.id,
            chapterId: 'runtime-fundamentals',
            lessonId: 'main-thread',
          }}
        />
      </AppProviders>,
    );

    expect(await screen.findByText('Đang xem lại')).toBeVisible();
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Chế độ xem lại')).not.toBeInTheDocument();
  });

  it('renders an assessment inside the same top navigation and assistant shell', async () => {
    const assessmentNavigation: CourseNavigationPayload = {
      ...navigation,
      currentLessonId: null,
      viewedItemId: 'runtime-checkpoint',
      nextAction: { type: 'NONE' },
      chapters: [
        {
          id: 'runtime-fundamentals',
          title: 'Runtime Fundamentals',
          status: 'ASSESSMENT_REQUIRED',
          required: true,
          lessons: navigation.chapters[0]?.lessons ?? [],
          assessments: [
            {
              id: 'runtime-checkpoint',
              title: 'Runtime Checkpoint',
              status: 'AVAILABLE',
              required: true,
              viewed: true,
              blockingRequirements: [],
            },
          ],
        },
      ],
    };
    const api: SynaploomApiClient = {
      ...fakeApi(),
      getNavigation: () => Promise.resolve(assessmentNavigation),
      getChapterAssessment: () =>
        Promise.resolve({
          id: 'runtime-checkpoint',
          chapterId: 'runtime-fundamentals',
          title: 'Runtime Checkpoint',
          required: true,
          status: 'AVAILABLE' as const,
          requirements: [],
          latestResult: null,
          bestResult: null,
          actions: [{ id: 'check', label: 'Kiểm tra kết quả' }],
          editable: [],
        }),
    };

    render(
      <AppProviders api={api}>
        <LearningWorkspacePage
          route={{
            kind: 'assessment',
            courseId: course.id,
            chapterId: 'runtime-fundamentals',
            assessmentId: 'runtime-checkpoint',
          }}
        />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Runtime Checkpoint', level: 1 }),
    ).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Điều hướng khóa học' })).toBeVisible();
    expect(screen.getByText('Trợ lý AI')).toBeVisible();
    expect(document.querySelector('.syn-assessment-page')).not.toBeInTheDocument();
  });
});
