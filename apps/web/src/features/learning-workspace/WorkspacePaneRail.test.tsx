import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { WorkspacePaneRail } from '#src/features/learning-workspace/WorkspacePaneRail';
import type { LearningWorkspaceController } from '#src/features/learning-workspace/useLearningWorkspaceController';
import type { ResolvedWorkspaceActivity } from '#src/features/learning-workspace/workspace-model';

const policy = {
  purpose: 'practice' as const,
  maxAttempts: null,
  feedbackMode: 'immediate' as const,
  revealAnswers: 'never' as const,
  scoring: 'points' as const,
  passingScore: null,
};
const activities: ResolvedWorkspaceActivity[] = ['A', 'B', 'C', 'D'].map((id) => ({
  setId: 'set',
  required: true,
  policy,
  activity: {
    id,
    kind: 'short-answer',
    title: id,
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
}));

it('opens the no-focus tray locally and delegates selection', () => {
  const focusActivity = vi.fn(() => Promise.resolve());
  render(
    <WorkspacePaneRail
      activities={activities}
      statuses={[]}
      focusedActivity={null}
      controller={{ focusActivity } as unknown as LearningWorkspaceController}
    />,
  );
  fireEvent.click(screen.getByText('Chọn hoạt động thực hành, 4 hoạt động'));
  expect(screen.getByRole('region', { name: 'Hoạt động trong bài' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /^B Bắt buộc/ }));
  expect(focusActivity).toHaveBeenCalledWith('B');
});

it('restores a collapsed focused activity', () => {
  const restoreSplitPane = vi.fn(() => Promise.resolve());
  render(
    <WorkspacePaneRail
      activities={activities}
      statuses={[]}
      focusedActivity={activities[1] ?? null}
      controller={{ restoreSplitPane } as unknown as LearningWorkspaceController}
    />,
  );
  expect(screen.getByText('B đang tạm ẩn.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Mở lại B' }));
  expect(restoreSplitPane).toHaveBeenCalled();
});
