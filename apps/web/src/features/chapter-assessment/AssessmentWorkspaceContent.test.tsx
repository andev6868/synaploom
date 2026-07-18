import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CourseNavigationPayload, PublicActivitySetPayload } from '@synaploom/protocol';
import { AppProviders } from '#src/app/providers/AppProviders';
import type { SynaploomApiClient } from '#src/shared/api/client';
import { AssessmentWorkspaceContent } from './AssessmentWorkspaceContent';

const navigation: CourseNavigationPayload = {
  courseId: 'perf',
  currentLessonId: null,
  viewedItemId: 'runtime-checkpoint',
  viewMode: 'LEARNING',
  returnTarget: null,
  nextAction: { type: 'CONTINUE_TO_CHAPTER', chapterId: 'rendering' },
  chapters: [
    {
      id: 'runtime',
      title: 'Runtime',
      status: 'ASSESSMENT_REQUIRED',
      required: true,
      lessons: [],
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
    {
      id: 'rendering',
      title: 'Rendering Performance',
      status: 'AVAILABLE',
      required: true,
      lessons: [],
      assessments: [],
    },
  ],
};

const assessmentSets: readonly PublicActivitySetPayload[] = [
  {
    id: 'runtime-checkpoint-set',
    title: 'Runtime Checkpoint',
    policy: {
      purpose: 'assessment',
      maxAttempts: 2,
      feedbackMode: 'after-submit',
      revealAnswers: 'after-final-attempt',
      scoring: 'points',
      passingScore: 2,
    },
    activities: [
      {
        required: true,
        activity: {
          id: 'event-loop-order',
          kind: 'true-false',
          title: 'Promise chạy trước timer',
          prompt: { blocks: [] },
          config: {},
          evaluation: { mode: 'automatic', points: 1 },
          completion: { required: true },
        },
      },
      {
        required: true,
        activity: {
          id: 'main-thread',
          kind: 'single-choice',
          title: 'Main thread thực thi gì?',
          prompt: { blocks: [] },
          config: {
            options: [
              { id: 'a', label: 'JavaScript' },
              { id: 'b', label: 'Không gì cả' },
            ],
          },
          evaluation: { mode: 'automatic', points: 1 },
          completion: { required: true },
        },
      },
    ],
  },
];

function fakeApi(overrides: Partial<SynaploomApiClient> = {}): SynaploomApiClient {
  return {
    getCourse: () => Promise.reject(new Error('not used')),
    getNavigation: () => Promise.resolve(navigation),
    getLessonView: () => Promise.reject(new Error('not used')),
    getChapterAssessment: () =>
      Promise.resolve({
        id: 'runtime-checkpoint',
        chapterId: 'runtime',
        title: 'Runtime Checkpoint',
        required: true,
        status: 'AVAILABLE',
        requirements: [
          {
            id: 'event-loop',
            kind: 'lesson',
            required: true,
            satisfied: true,
            attempted: true,
            latestPassed: true,
          },
        ],
        latestResult: null,
        bestResult: null,
        actions: [],
        editable: [],
      }),
    recordChapterAssessment: () => Promise.reject(new Error('legacy action must not be used')),
    getActivitySets: () => Promise.resolve(assessmentSets),
    getActivity: () => Promise.reject(new Error('not used')),
    getCurrentActivityAttempt: () => Promise.resolve(null),
    saveActivityDraft: () => Promise.reject(new Error('not used')),
    submitActivityAttempt: () => Promise.reject(new Error('not used')),
    getActivitySetProgress: () =>
      Promise.resolve({
        status: 'IN_PROGRESS',
        completedRequiredActivities: 1,
        requiredActivities: 2,
        score: 1,
        maxScore: 2,
        passed: false,
      }),
    getCurrentLesson: () => Promise.reject(new Error('not used')),
    getLesson: () => Promise.reject(new Error('not used')),
    startLesson: () => Promise.resolve(),
    acknowledgeReading: () => Promise.resolve(),
    completeLesson: () => Promise.reject(new Error('not used')),
    listFiles: () => Promise.resolve([]),
    readFile: () => Promise.resolve({ path: '', content: '' }),
    writeFile: () => Promise.resolve(),
    resetWorkspace: () => Promise.resolve(),
    runAction: () => Promise.resolve({ sessionId: 'session', eventsUrl: '/events' }),
    requestAi: () =>
      Promise.resolve({ status: 'disabled', message: 'AI assistance is not configured.' }),
    getPaneRatio: () => Promise.resolve(0.48),
    setPaneRatio: (ratio) => Promise.resolve(ratio),
    ...overrides,
  };
}

describe('AssessmentWorkspaceContent', () => {
  it('renders assessment-set score and progress without the legacy pass action', async () => {
    const legacyAction = vi.fn();
    render(
      <AppProviders api={fakeApi({ recordChapterAssessment: legacyAction })}>
        <AssessmentWorkspaceContent
          courseId="perf"
          chapterId="runtime"
          assessmentId="runtime-checkpoint"
          navigation={navigation}
          onAction={vi.fn()}
        />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Runtime Checkpoint', level: 1 }),
    ).toBeVisible();
    expect(await screen.findByText('1/2 hoạt động bắt buộc đã hoàn thành')).toBeVisible();
    expect(screen.getByText('Điểm hiện tại: 1/2')).toBeVisible();
    expect(screen.getByText('Chưa đạt ngưỡng 2 điểm')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Kiểm tra kết quả' })).not.toBeInTheDocument();
    expect(legacyAction).not.toHaveBeenCalled();
  });

  it('renders assessment activities through the shared activity engine', async () => {
    render(
      <AppProviders api={fakeApi()}>
        <AssessmentWorkspaceContent
          courseId="perf"
          chapterId="runtime"
          assessmentId="runtime-checkpoint"
          navigation={navigation}
          onAction={vi.fn()}
        />
      </AppProviders>,
    );

    expect(await screen.findByRole('group', { name: 'Promise chạy trước timer' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Đúng' })).toBeVisible();
    expect(document.querySelector('article[data-layout="focused-activity"]')).toBeInTheDocument();
  });

  it('fails closed when an assessment has no activity set', async () => {
    render(
      <AppProviders api={fakeApi({ getActivitySets: () => Promise.resolve([]) })}>
        <AssessmentWorkspaceContent
          courseId="perf"
          chapterId="runtime"
          assessmentId="runtime-checkpoint"
          navigation={navigation}
          onAction={vi.fn()}
        />
      </AppProviders>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Đánh giá này chưa có nội dung hoạt động hợp lệ.',
    );
  });
});
