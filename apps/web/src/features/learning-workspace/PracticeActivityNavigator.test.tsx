import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { PracticeActivityNavigator } from '#src/features/learning-workspace/PracticeActivityNavigator';
import type { ResolvedWorkspaceActivity } from '#src/features/learning-workspace/workspace-model';

const policy = {
  purpose: 'practice' as const,
  maxAttempts: null,
  feedbackMode: 'immediate' as const,
  revealAnswers: 'never' as const,
  scoring: 'points' as const,
  passingScore: null,
};
function item(id: string): ResolvedWorkspaceActivity {
  return {
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
        defaultSurface: 'practice',
        allowInline: true,
        allowPractice: true,
        preferredWidth: 'compact',
        supportsFullscreen: false,
      },
    },
  };
}
const activities = [item('A'), item('B')];

it('renders authored order, ordinal, status and active state', () => {
  render(
    <PracticeActivityNavigator
      activities={activities}
      statuses={[
        {
          activityId: 'A',
          status: 'PASSED',
          attemptNumber: 1,
          score: 1,
          maxScore: 1,
          passed: true,
        },
      ]}
      focusedActivityId="B"
      onSelectActivity={vi.fn(() => Promise.resolve())}
    />,
  );
  expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
    expect.stringContaining('1A'),
    expect.stringContaining('2B'),
  ]);
  expect(screen.getByText('Đã đạt')).toBeVisible();
  expect(screen.getByText('Đã đạt')).toHaveAttribute('data-navigator-status');
  expect(document.querySelector('[data-navigator-guidance-icon]')).toBeVisible();
  expect(screen.getByRole('button', { name: /2\. B/ })).toHaveAttribute('aria-current', 'true');
  expect(screen.getByRole('button', { name: /2\. B/ })).toHaveAttribute('data-navigator-item');
});

it('closes only after selection succeeds', async () => {
  const close = vi.fn();
  const select = vi.fn(() => Promise.resolve());
  render(
    <PracticeActivityNavigator
      activities={activities}
      statuses={[]}
      focusedActivityId="A"
      onSelectActivity={select}
      onSelectionComplete={close}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /2\. B/ }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(select).toHaveBeenCalledWith('B');
});

it('stays open when save-before-switch fails', async () => {
  const close = vi.fn();
  render(
    <PracticeActivityNavigator
      activities={activities}
      statuses={[]}
      focusedActivityId="A"
      onSelectActivity={() => Promise.reject(new Error('save failed'))}
      onSelectionComplete={close}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /2\. B/ }));
  await waitFor(() => expect(close).not.toHaveBeenCalled());
});
