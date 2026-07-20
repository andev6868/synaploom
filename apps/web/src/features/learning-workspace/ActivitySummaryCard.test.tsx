import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ActivitySummaryCard } from '#src/features/learning-workspace/ActivitySummaryCard';
import type { ResolvedWorkspaceActivity } from '#src/features/learning-workspace/workspace-model';

const item: ResolvedWorkspaceActivity = {
  setId: 'set',
  required: true,
  policy: {
    purpose: 'practice',
    maxAttempts: null,
    feedbackMode: 'immediate',
    revealAnswers: 'never',
    scoring: 'points',
    passingScore: null,
  },
  activity: {
    id: 'quiz',
    kind: 'short-answer',
    title: 'Quiz',
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
};

const draftStatus = {
  activityId: 'quiz',
  status: 'DRAFT' as const,
  attemptNumber: 1,
  score: null,
  maxScore: null,
  passed: null,
};

it('describes the focused activity as open in Practice', () => {
  render(
    <ActivitySummaryCard
      item={item}
      focused
      paneMode="split"
      status={draftStatus}
      onOpenPractice={vi.fn(() => Promise.resolve())}
    />,
  );

  expect(screen.getByText('Đang làm · Đã lưu bản nháp')).toHaveAttribute(
    'data-activity-summary-status',
  );
  expect(document.querySelector('[data-activity-summary-card]')).toBeVisible();
  expect(document.querySelector('[data-activity-summary-icon]')).toBeVisible();
  expect(document.querySelector('[data-activity-status-indicator]')).toBeVisible();
  expect(document.querySelector('[data-activity-cta-icon]')).toBeVisible();
  const activeSummary = screen
    .getByText('Activity đang mở trong khu vực thực hành.')
    .closest('section');
  expect(activeSummary).toHaveClass('syn-activity-summary--active');
  expect(screen.getByRole('button', { name: 'Quay lại thực hành' })).toBeVisible();
});

it('uses a restore action when focused Practice is collapsed', () => {
  const open = vi.fn(() => Promise.resolve());
  render(
    <ActivitySummaryCard
      item={item}
      focused
      paneMode="collapsed"
      status={draftStatus}
      onOpenPractice={open}
    />,
  );

  expect(screen.getByText('Activity đang tạm ẩn trong khu vực thực hành.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Mở lại thực hành' }));
  expect(open).toHaveBeenCalledWith('quiz');
});
