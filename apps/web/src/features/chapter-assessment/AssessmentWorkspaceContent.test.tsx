import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CourseNavigationPayload } from '@synaploom/protocol';
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

function fakeApi(record = vi.fn()): SynaploomApiClient {
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
        latestResult: { score: 80, summary: 'Đạt yêu cầu' },
        bestResult: { score: 80 },
        actions: [{ id: 'check', label: 'Kiểm tra kết quả' }],
        editable: [],
      }),
    recordChapterAssessment: record.mockResolvedValue({ navigation }),
    getActivitySets: () => Promise.resolve([]),
    getActivity: () => Promise.reject(new Error('not used')),
    getCurrentActivityAttempt: () => Promise.resolve(null),
    saveActivityDraft: () => Promise.reject(new Error('not used')),
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

describe('AssessmentWorkspaceContent', () => {
  it('renders assessment state and submits without leaving the shared workspace', async () => {
    const record = vi.fn();
    render(
      <AppProviders api={fakeApi(record)}>
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
    expect(screen.getByText('Đạt yêu cầu')).toBeVisible();
    expect(screen.getByText('Điểm cao nhất: 80')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra kết quả' }));

    await waitFor(() =>
      expect(record).toHaveBeenCalledWith('runtime', 'runtime-checkpoint', {
        passed: true,
        summary: 'Completed from assessment workspace.',
      }),
    );
  });
});

it('renders assessment activities through the shared activity engine', async () => {
  const activityApi: SynaploomApiClient = {
    ...fakeApi(),
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
                id: 'event-loop-order',
                kind: 'true-false',
                title: 'Promise chạy trước timer',
                prompt: { blocks: [] },
                config: {},
                evaluation: { mode: 'automatic', points: 1 },
                completion: { required: true },
              },
            },
          ],
        },
      ]),
  };

  render(
    <AppProviders api={activityApi}>
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
  expect(screen.queryByRole('button', { name: 'Kiểm tra kết quả' })).not.toBeInTheDocument();
});
