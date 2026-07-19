import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  ActivityStatusPayload,
  ChapterAssessmentPayload,
  CourseNavigationPayload,
  PublicActivitySetPayload,
} from '@synaploom/protocol';
import { AppProviders } from '#src/app/providers/AppProviders';
import type { LearningWorkspaceController } from '#src/features/learning-workspace/useLearningWorkspaceController';
import { flattenWorkspaceActivities } from '#src/features/learning-workspace/workspace-model';
import type { SynaploomApiClient } from '#src/shared/api/client';
import { AssessmentWorkspaceContent } from '#src/features/chapter-assessment/AssessmentWorkspaceContent';

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
  ],
};

const assessment: ChapterAssessmentPayload = {
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
};

const activitySets: readonly PublicActivitySetPayload[] = [
  {
    id: 'runtime-checkpoint-set',
    title: 'Runtime Checkpoint',
    policy: {
      purpose: 'assessment' as const,
      maxAttempts: 2,
      feedbackMode: 'after-submit' as const,
      revealAnswers: 'after-final-attempt' as const,
      scoring: 'points' as const,
      passingScore: 2,
    },
    activities: [
      {
        required: true,
        activity: {
          id: 'event-loop-order',
          kind: 'true-false' as const,
          title: 'Promise chạy trước timer',
          prompt: { blocks: [] },
          config: {},
          evaluation: { mode: 'automatic' as const, points: 1 },
          completion: { required: true },
          presentation: {
            defaultSurface: 'inline' as const,
            allowInline: true,
            allowPractice: true,
            preferredWidth: 'compact' as const,
            supportsFullscreen: false,
          },
        },
      },
      {
        required: true,
        activity: {
          id: 'main-thread',
          kind: 'single-choice' as const,
          title: 'Main thread thực thi gì?',
          prompt: { blocks: [] },
          config: {
            options: [
              { id: 'a', label: 'JavaScript' },
              { id: 'b', label: 'Không gì cả' },
            ],
          },
          evaluation: { mode: 'automatic' as const, points: 1 },
          completion: { required: true },
          presentation: {
            defaultSurface: 'practice' as const,
            allowInline: false,
            allowPractice: true,
            preferredWidth: 'standard' as const,
            supportsFullscreen: false,
          },
        },
      },
    ],
  },
];
const activities = flattenWorkspaceActivities(activitySets);
const statuses: readonly ActivityStatusPayload[] = [
  {
    activityId: 'event-loop-order',
    status: 'PASSED',
    attemptNumber: 1,
    score: 1,
    maxScore: 1,
    passed: true,
  },
  {
    activityId: 'main-thread',
    status: 'DRAFT',
    attemptNumber: 1,
    score: null,
    maxScore: null,
    passed: null,
  },
];

function controller(focusedActivityId: string | null = null): LearningWorkspaceController {
  const focusedActivity = activities.find((item) => item.activity.id === focusedActivityId) ?? null;
  return {
    state: {
      courseId: 'perf',
      ownerKind: 'assessments',
      ownerId: assessment.id,
      focusedActivityId,
      paneMode: focusedActivityId ? 'split' : 'collapsed',
      splitRatio: 0.45,
      userCollapsed: false,
      revision: 1,
      updatedAt: '2026-07-19T00:00:00Z',
    },
    saveStatus: 'idle',
    error: null,
    conflictState: null,
    focusedActivity,
    registerPersistenceHandle: vi.fn(),
    focusActivity: vi.fn().mockResolvedValue(undefined),
    returnActivityInline: vi.fn().mockResolvedValue(undefined),
    collapsePracticePane: vi.fn().mockResolvedValue(undefined),
    expandPracticePane: vi.fn().mockResolvedValue(undefined),
    restoreSplitPane: vi.fn().mockResolvedValue(undefined),
    setSplitRatio: vi.fn().mockResolvedValue(undefined),
    selectNextActivity: vi.fn().mockResolvedValue(undefined),
    retryLastSave: vi.fn().mockResolvedValue(undefined),
  };
}

function fakeApi(): SynaploomApiClient {
  return {
    getCourse: () => Promise.reject(new Error('not used')),
    getNavigation: () => Promise.resolve(navigation),
    getLessonView: () => Promise.reject(new Error('not used')),
    getChapterAssessment: () => Promise.resolve(assessment),
    recordChapterAssessment: () => Promise.reject(new Error('not used')),
    getWorkspacePresentation: () => Promise.reject(new Error('not used')),
    updateWorkspacePresentation: () => Promise.reject(new Error('not used')),
    getActivityStatuses: () => Promise.resolve(statuses),
    getActivitySets: () => Promise.resolve(activitySets),
    getActivity: () => Promise.reject(new Error('not used')),
    getCurrentActivityAttempt: () => Promise.resolve(null),
    saveActivityDraft: () => Promise.resolve({} as never),
    submitActivityAttempt: () => Promise.reject(new Error('not used')),
    getActivitySetProgress: () => Promise.reject(new Error('not used')),
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
  };
}

function renderContent(workspaceController = controller(), items = activities): void {
  render(
    <AppProviders api={fakeApi()}>
      <AssessmentWorkspaceContent
        chapterId="runtime"
        assessment={assessment}
        navigation={navigation}
        activities={items}
        statuses={statuses}
        focusedActivityId={workspaceController.state.focusedActivityId}
        controller={workspaceController}
        onAction={vi.fn()}
        onProgressChanged={vi.fn().mockResolvedValue(undefined)}
      />
    </AppProviders>,
  );
}

describe('AssessmentWorkspaceContent', () => {
  it('keeps assessment policy, score, progress, and requirement footer in theory', () => {
    renderContent();
    expect(screen.getByRole('heading', { name: 'Runtime Checkpoint', level: 1 })).toBeVisible();
    expect(screen.getByText('Tối đa 2 lần cho mỗi hoạt động.')).toBeVisible();
    expect(screen.getByText('1/2 hoạt động bắt buộc đã hoàn thành')).toBeVisible();
    expect(screen.getByText('Điểm hiện tại: 1/2')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Yêu cầu hoàn thành đánh giá' })).toBeVisible();
  });

  it('renders focused activities as summaries and practice-only activities as launch cards', () => {
    renderContent(controller('event-loop-order'));
    expect(
      screen.getByText('Promise chạy trước timer đang mở trong khu vực thực hành.'),
    ).toBeVisible();
    expect(
      screen.queryByRole('group', { name: 'Promise chạy trước timer' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mở khu vực thực hành' })).toBeVisible();
    expect(screen.queryByRole('radio', { name: 'Đúng' })).not.toBeInTheDocument();
  });

  it('fails closed when an assessment has no activity set', () => {
    renderContent(controller(), []);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Đánh giá này chưa có nội dung hoạt động hợp lệ.',
    );
  });
});
