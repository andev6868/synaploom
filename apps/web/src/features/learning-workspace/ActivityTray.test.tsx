import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ActivityTray } from '#src/features/learning-workspace/ActivityTray';
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
function item(id: string, required: boolean): ResolvedWorkspaceActivity {
  return {
    setId: 'set',
    required,
    policy,
    activity: {
      id,
      kind: 'short-answer',
      title: id,
      prompt: { blocks: [] },
      config: {},
      evaluation: { mode: 'automatic', points: 1 },
      completion: { required },
      presentation: {
        defaultSurface: 'inline',
        allowInline: true,
        allowPractice: true,
        preferredWidth: 'compact',
        supportsFullscreen: false,
      },
    },
  };
}
const activities = [
  item('Kiểm tra nhanh', true),
  item('Coding lab', true),
  item('Bài viết phản tư', false),
];

it('renders authored order, required labels and text statuses without mounting editors', () => {
  const focusActivity = vi.fn(() => Promise.resolve());
  render(
    <ActivityTray
      activities={activities}
      statuses={[
        {
          activityId: 'Kiểm tra nhanh',
          status: 'PASSED',
          attemptNumber: 1,
          score: 1,
          maxScore: 1,
          passed: true,
        },
        {
          activityId: 'Coding lab',
          status: 'DRAFT',
          attemptNumber: 1,
          score: null,
          maxScore: null,
          passed: null,
        },
      ]}
      controller={{ focusActivity } as unknown as LearningWorkspaceController}
      focusedActivityId="Coding lab"
    />,
  );
  expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
    expect.stringContaining('Kiểm tra nhanh'),
    expect.stringContaining('Coding lab'),
    expect.stringContaining('Bài viết phản tư'),
  ]);
  expect(screen.getByText('Đã đạt')).toBeVisible();
  expect(screen.getByText('Bản nháp')).toBeVisible();
  expect(screen.getByRole('button', { name: /Coding lab/ })).toHaveAttribute('aria-current', 'true');
  expect(screen.getByText('Chưa bắt đầu')).toBeVisible();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Coding lab/ }));
  expect(focusActivity).toHaveBeenCalledWith('Coding lab');
});
