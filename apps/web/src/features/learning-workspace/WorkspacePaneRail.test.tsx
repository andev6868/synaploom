import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

it('opens the no-focus navigator without native details and delegates selection', async () => {
  const focusActivity = vi.fn(() => Promise.resolve());
  render(
    <WorkspacePaneRail
      activities={activities}
      statuses={[]}
      focusedActivity={null}
      controller={{ focusActivity } as unknown as LearningWorkspaceController}
    />,
  );
  expect(document.querySelector('details')).not.toBeInTheDocument();
  const chooser = screen.getByRole('button', { name: 'Chọn hoạt động thực hành' });
  expect(chooser).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(chooser);
  expect(chooser).toHaveAttribute('aria-expanded', 'true');
  const navigator = screen.getByRole('navigation', { name: 'Danh sách hoạt động' });
  expect(navigator).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '2. B. Chưa mở' }));
  await waitFor(() => expect(focusActivity).toHaveBeenCalledWith('B'));
  await waitFor(() => expect(navigator).not.toBeInTheDocument());
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
  const rail = screen.getByLabelText('Khu vực thực hành đang thu gọn');
  expect(rail).toHaveAttribute('data-workspace-practice-rail');
  const restore = screen.getByRole('button', { name: 'Mở lại B' });
  expect(restore).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(restore);
  expect(restoreSplitPane).toHaveBeenCalled();
});
