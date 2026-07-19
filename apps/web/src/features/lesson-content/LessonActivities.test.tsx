import type { LessonBlock } from '@synaploom/contracts';
import type { PublicActivitySetPayload } from '@synaploom/protocol';
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { LessonActivities } from '#src/features/lesson-content/LessonActivities';
import { flattenWorkspaceActivities } from '#src/features/learning-workspace/workspace-model';
import type { LearningWorkspaceController } from '#src/features/learning-workspace/useLearningWorkspaceController';

const sets: readonly PublicActivitySetPayload[] = [
  {
    id: 'practice',
    title: 'Practice',
    policy: {
      purpose: 'practice',
      maxAttempts: null,
      feedbackMode: 'immediate',
      revealAnswers: 'never',
      scoring: 'points',
      passingScore: null,
    },
    activities: [
      {
        required: true,
        activity: {
          id: 'embedded',
          kind: 'true-false',
          title: 'Embedded question',
          prompt: { blocks: [] },
          config: {},
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
      {
        required: false,
        activity: {
          id: 'appended',
          kind: 'short-answer',
          title: 'Appended question',
          prompt: { blocks: [] },
          config: { maximumLength: 40 },
          evaluation: { mode: 'automatic', points: 1 },
          completion: { required: false },
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
];

it('renders embedded activities in document position and appends remaining activities in manifest order', () => {
  const blocks: readonly LessonBlock[] = [
    { type: 'paragraph', children: [{ type: 'text', value: 'Before activity' }] },
    { type: 'activity', activityId: 'embedded' },
    { type: 'paragraph', children: [{ type: 'text', value: 'After activity' }] },
  ];
  render(
    <LessonActivities
      blocks={blocks}
      activities={flattenWorkspaceActivities(sets)}
      statuses={[]}
      focusedActivityId={null}
      controller={
        {
          state: { paneMode: 'collapsed' },
          registerPersistenceHandle: vi.fn(),
          registerPracticeHeading: vi.fn(),
          registerInlineHeading: vi.fn(),
          focusActivity: vi.fn(),
          restoreSplitPane: vi.fn(),
        } as unknown as LearningWorkspaceController
      }
    />,
  );

  const before = screen.getByText('Before activity');
  const embedded = screen
    .getByRole('heading', { name: 'Embedded question' })
    .closest('section') as HTMLElement;
  const after = screen.getByText('After activity');
  const appended = screen
    .getByRole('heading', { name: 'Appended question' })
    .closest('section') as HTMLElement;
  expect(before.compareDocumentPosition(embedded) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(embedded.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(after.compareDocumentPosition(appended) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('fails closed before rendering when an activity is embedded more than once', () => {
  const blocks: readonly LessonBlock[] = [
    { type: 'activity', activityId: 'embedded' },
    {
      type: 'details',
      summary: [{ type: 'text', value: 'More' }],
      open: true,
      blocks: [{ type: 'activity', activityId: 'embedded' }],
    },
  ];
  render(
    <LessonActivities
      blocks={blocks}
      activities={flattenWorkspaceActivities(sets)}
      statuses={[]}
      focusedActivityId={null}
      controller={
        {
          state: { paneMode: 'collapsed' },
          registerPersistenceHandle: vi.fn(),
          registerPracticeHeading: vi.fn(),
          registerInlineHeading: vi.fn(),
          focusActivity: vi.fn(),
          restoreSplitPane: vi.fn(),
        } as unknown as LearningWorkspaceController
      }
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('được nhúng nhiều hơn một lần');
  expect(screen.queryByText('Embedded question')).not.toBeInTheDocument();
});

it('replaces a focused embedded activity with a summary at the same document position', () => {
  const blocks: readonly LessonBlock[] = [
    { type: 'paragraph', children: [{ type: 'text', value: 'Before focused activity' }] },
    { type: 'activity', activityId: 'embedded' },
  ];
  render(
    <LessonActivities
      blocks={blocks}
      activities={flattenWorkspaceActivities(sets)}
      statuses={[]}
      focusedActivityId="embedded"
      controller={
        {
          state: { paneMode: 'collapsed' },
          registerPersistenceHandle: vi.fn(),
          registerPracticeHeading: vi.fn(),
          registerInlineHeading: vi.fn(),
          focusActivity: vi.fn(),
          restoreSplitPane: vi.fn(),
        } as unknown as LearningWorkspaceController
      }
    />,
  );

  expect(screen.getByText('Before focused activity')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Embedded question' })).toBeVisible();
  expect(screen.getByText('Activity đang tạm ẩn trong khu vực thực hành.')).toBeVisible();
});
