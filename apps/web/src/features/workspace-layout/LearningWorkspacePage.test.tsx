import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    getWorkspacePresentation: () =>
      Promise.resolve({
        courseId: 'course',
        ownerKind: 'lessons' as const,
        ownerId: 'lesson',
        focusedActivityId: null,
        paneMode: 'collapsed' as const,
        splitRatio: 0.45,
        userCollapsed: false,
        revision: 0,
        updatedAt: '',
      }),
    updateWorkspacePresentation: (_owner, payload) =>
      Promise.resolve({
        ...{
          courseId: 'course',
          ownerKind: 'lessons' as const,
          ownerId: 'lesson',
          focusedActivityId: null,
          paneMode: 'collapsed' as const,
          splitRatio: 0.45,
          userCollapsed: false,
          revision: 0,
          updatedAt: '',
        },
        ...payload,
        revision: payload.revision + 1,
      }),
    getActivityStatuses: () => Promise.resolve([]),
    getActivitySets: () => Promise.resolve([]),
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

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    matches: query.includes('1440'),
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: () => true,
  }));
});

afterEach(() => vi.unstubAllGlobals());

describe('LearningWorkspacePage', () => {
  it('renders the focused lesson and practice workspace from typed daemon data', async () => {
    render(
      <AppProviders api={fakeApi()}>
        <LearningWorkspacePage route={{ kind: 'lesson', lessonId: null }} />
      </AppProviders>,
    );
    expect(await screen.findByRole('heading', { name: 'Main Thread', level: 1 })).toBeVisible();
    expect(screen.getByRole('progressbar', { name: 'Tiến độ bài học' })).toBeVisible();
    expect(document.querySelector('[data-theory-reading-column]')).toBeVisible();
    expect(document.querySelector('[data-lesson-progress-card]')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Mục tiêu học tập' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Điều hướng khóa học' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Nội dung' })).toBeEnabled();
    expect(screen.getByLabelText('Hồ sơ người học')).toHaveTextContent('N');
    expect(screen.getByTestId('app-header-divider')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Hoàn thành phần đọc' })).toBeEnabled();
    expect(
      screen.queryByRole('separator', { name: 'Thay đổi kích thước hai vùng học' }),
    ).not.toBeInTheDocument();
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
      getWorkspacePresentation: () =>
        Promise.resolve({
          courseId: course.id,
          ownerKind: 'assessments',
          ownerId: 'runtime-checkpoint',
          focusedActivityId: 'assessment-question',
          paneMode: 'split',
          splitRatio: 0.45,
          userCollapsed: false,
          revision: 1,
          updatedAt: '2026-07-19T00:00:00Z',
        }),
      getActivityStatuses: () =>
        Promise.resolve([
          {
            activityId: 'assessment-question',
            status: 'AVAILABLE',
            attemptNumber: 0,
            score: null,
            maxScore: null,
            passed: null,
          },
        ]),
      getActivitySets: () =>
        Promise.resolve([
          {
            id: 'runtime-checkpoint-set',
            title: 'Runtime Checkpoint',
            policy: {
              purpose: 'assessment',
              maxAttempts: 2,
              feedbackMode: 'after-submit',
              revealAnswers: 'after-final-attempt',
              scoring: 'points',
              passingScore: 1,
            },
            activities: [
              {
                required: true,
                activity: {
                  id: 'assessment-question',
                  kind: 'true-false',
                  title: 'Promise chạy trước timer',
                  prompt: { blocks: [] },
                  config: {},
                  evaluation: { mode: 'automatic', points: 1 },
                  completion: { required: true },
                  presentation: {
                    defaultSurface: 'practice',
                    allowInline: true,
                    allowPractice: true,
                    preferredWidth: 'compact',
                    supportsFullscreen: false,
                  },
                },
              },
            ],
          },
        ]),
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
    expect(screen.getAllByLabelText('Trợ lý AI')[0]).toHaveClass('syn-assistant-context');
    expect(
      screen.getByRole('separator', { name: 'Thay đổi kích thước hai vùng học' }),
    ).toBeVisible();
    expect(screen.getByText('Activity đang mở trong khu vực thực hành.')).toBeVisible();
    expect(screen.getAllByRole('radio', { name: 'Đúng' })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Yêu cầu hoàn thành đánh giá' })).toBeVisible();
    expect(document.querySelector('.syn-assessment-workspace')).not.toBeInTheDocument();
  });

  it('renders embedded non-coding activity summaries with one Practice editor', async () => {
    const lessonWithActivity = {
      ...lesson,
      blocks: [...lesson.blocks, { type: 'activity' as const, activityId: 'main-thread-check' }],
    };
    const api: SynaploomApiClient = {
      ...fakeApi(),
      getCurrentLesson: () => Promise.resolve(lessonWithActivity),
      getLesson: () => Promise.resolve(lessonWithActivity),
      getActivitySets: () =>
        Promise.resolve([
          {
            id: 'main-thread-practice',
            policy: {
              purpose: 'practice',
              maxAttempts: null,
              feedbackMode: 'immediate',
              revealAnswers: 'after-submit',
              scoring: 'points',
              passingScore: null,
            },
            activities: [
              {
                required: true,
                activity: {
                  id: 'main-thread-check',
                  kind: 'single-choice',
                  title: 'Main Thread làm gì?',
                  prompt: { blocks: [] },
                  config: {
                    options: [
                      { id: 'render', label: 'Render và chạy JavaScript' },
                      { id: 'network', label: 'Chỉ tải mạng' },
                    ],
                  },
                  evaluation: { mode: 'automatic', points: 1 },
                  completion: { required: true },
                  presentation: {
                    defaultSurface: 'inline',
                    allowInline: true,
                    allowPractice: true,
                    preferredWidth: 'compact',
                    supportsFullscreen: false,
                  },
                },
              },
            ],
          },
        ]),
    };

    render(
      <AppProviders api={api}>
        <LearningWorkspacePage route={{ kind: 'lesson', lessonId: null }} />
      </AppProviders>,
    );

    expect(await screen.findByRole('heading', { name: 'Main Thread làm gì?' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Thực hành bài này' })).toBeVisible();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('separator', { name: 'Thay đổi kích thước hai vùng học' }),
    ).not.toBeInTheDocument();
  });

  it('uses the shared split Practice layout for a coding activity', async () => {
    const api: SynaploomApiClient = {
      ...fakeApi(),
      listActivityFiles: () => Promise.resolve(['index.js']),
      readActivityFile: () => Promise.resolve({ path: 'index.js', content: 'console.log("ok")' }),
      writeActivityFile: () => Promise.resolve(),
      resetActivityWorkspace: () => Promise.resolve(),
      runActivityAction: () => Promise.resolve({ sessionId: 'session', eventsUrl: '/events' }),
      getWorkspacePresentation: () =>
        Promise.resolve({
          courseId: 'course',
          ownerKind: 'lessons',
          ownerId: 'main-thread',
          focusedActivityId: 'main-thread-lab',
          paneMode: 'split',
          splitRatio: 0.45,
          userCollapsed: false,
          revision: 1,
          updatedAt: '2026-07-19T00:00:00Z',
        }),
      getActivitySets: () =>
        Promise.resolve([
          {
            id: 'main-thread-coding',
            policy: {
              purpose: 'practice',
              maxAttempts: null,
              feedbackMode: 'immediate',
              revealAnswers: 'after-submit',
              scoring: 'points',
              passingScore: null,
            },
            activities: [
              {
                required: true,
                activity: {
                  id: 'main-thread-lab',
                  kind: 'coding',
                  title: 'Main Thread Lab',
                  prompt: { blocks: [] },
                  config: {
                    schemaVersion: '1.0',
                    id: 'main-thread-lab',
                    title: 'Main Thread Lab',
                    runtime: { kind: 'local', requires: ['node'] },
                    workspace: { editable: ['index.js'] },
                    actions: {
                      run: {
                        label: 'Chạy',
                        executable: 'node',
                        args: ['index.js'],
                        timeoutMs: 1000,
                      },
                    },
                    checks: [],
                    completion: { requireAllRequiredChecks: true },
                  },
                  evaluation: { mode: 'coding', points: 1 },
                  completion: { required: true },
                  presentation: {
                    defaultSurface: 'inline',
                    allowInline: true,
                    allowPractice: true,
                    preferredWidth: 'compact',
                    supportsFullscreen: false,
                  },
                },
              },
            ],
          },
        ]),
    };

    render(
      <AppProviders api={api}>
        <LearningWorkspacePage route={{ kind: 'lesson', lessonId: null }} />
      </AppProviders>,
    );

    expect(await screen.findByText('Activity đang mở trong khu vực thực hành.')).toBeVisible();
    expect(document.querySelector('h2[data-workspace-activity-heading="true"]')).toHaveTextContent(
      'Main Thread Lab',
    );
    expect(await screen.findByRole('tab', { name: 'index.js' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Chạy' })).toBeVisible();
    expect(
      screen.getByRole('separator', { name: 'Thay đổi kích thước hai vùng học' }),
    ).toBeVisible();
    expect(screen.getByText('Activity đang mở trong khu vực thực hành.')).toBeVisible();
  });

  it('shows a completion icon when every required lesson is complete', async () => {
    const completedCourse = {
      ...course,
      lessons: [{ ...course.lessons[0]!, status: 'COMPLETED' as const }],
    };
    const completedNavigation = {
      ...navigation,
      chapters: navigation.chapters.map((chapter) => ({
        ...chapter,
        lessons: chapter.lessons.map((item) => ({ ...item, status: 'COMPLETED' as const })),
      })),
    };
    const api: SynaploomApiClient = {
      ...fakeApi(),
      getCourse: () => Promise.resolve(completedCourse),
      getNavigation: () => Promise.resolve(completedNavigation),
    };
    render(
      <AppProviders api={api}>
        <LearningWorkspacePage route={{ kind: 'lesson', lessonId: null }} />
      </AppProviders>,
    );
    expect(await screen.findByTestId('lesson-progress-complete-icon')).toBeVisible();
  });
});
