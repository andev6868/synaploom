import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { PracticePane } from '#src/features/learning-workspace/PracticePane';
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
function item(id: string, fullscreen = false): ResolvedWorkspaceActivity {
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
        preferredWidth: 'wide',
        supportsFullscreen: fullscreen,
      },
    },
  };
}
const activities = [item('Quiz'), item('Coding', true)];

it('mounts exactly one focused host and exposes explicit next and retry actions', () => {
  const selectNextActivity = vi.fn(() => Promise.resolve());
  const retryLastSave = vi.fn(() => Promise.resolve());
  const controller = {
    focusedActivity: activities[0],
    state: { paneMode: 'split' },
    saveStatus: 'error',
    error: new Error('save failed'),
    selectNextActivity,
    retryLastSave,
    registerPersistenceHandle: vi.fn(),
    registerPracticeHeading: vi.fn(),
    registerInlineHeading: vi.fn(),
    collapsePracticePane: vi.fn(),
    expandPracticePane: vi.fn(),
  } as unknown as LearningWorkspaceController;
  render(
    <PracticePane
      owner={{ courseId: 'course', ownerKind: 'lessons', ownerId: 'lesson' }}
      activities={activities}
      statuses={[
        {
          activityId: 'Quiz',
          status: 'PASSED',
          attemptNumber: 1,
          score: 1,
          maxScore: 1,
          passed: true,
        },
      ]}
      controller={controller}
      onProgressChanged={vi.fn()}
      renderHost={() => <input aria-label="active editor" />}
    />,
  );
  expect(screen.getByLabelText('Khu vực thực hành')).toHaveClass('syn-practice-pane');
  expect(screen.getByTestId('practice-workspace-card')).toHaveClass('syn-practice-workspace-card');
  expect(screen.getByTestId('practice-workspace-content')).toContainElement(
    screen.getByRole('textbox', { name: 'active editor' }),
  );
  expect(screen.getByTestId('practice-workspace-footer')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Danh sách hoạt động' })).toBeVisible();
  expect(screen.getByTestId('practice-header-controls')).toContainElement(
    screen.getByRole('button', { name: 'Danh sách hoạt động' }),
  );
  expect(screen.getByTestId('practice-active-status')).toHaveTextContent('Đã đạt');
  expect(screen.getByTestId('practice-save-status')).toHaveTextContent('Lưu thất bại');
  expect(screen.getByTestId('practice-footer-status')).toBeVisible();
  expect(screen.getByTestId('practice-footer-actions')).toBeVisible();
  expect(screen.queryByText('Hoạt động trong bài')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Quiz', level: 2 })).toHaveAttribute('tabindex', '-1');
  expect(screen.getAllByRole('textbox', { name: 'active editor' })).toHaveLength(1);
  expect(screen.getByText('Lưu thất bại')).toBeVisible();
  expect(screen.getByText('1/2')).toBeVisible();
  expect(screen.getByText('1/2')).toBeVisible();
  expect(screen.getByRole('alert')).toHaveTextContent('save failed');
  fireEvent.click(screen.getByRole('button', { name: 'Thử lưu lại' }));
  fireEvent.click(screen.getByRole('button', { name: 'Hoạt động tiếp theo' }));
  expect(retryLastSave).toHaveBeenCalled();
  expect(selectNextActivity).toHaveBeenCalled();
});

it('separates completion status from the footer action group', () => {
  const controller = {
    focusedActivity: activities[1],
    state: { paneMode: 'split' },
    saveStatus: 'saved',
    error: null,
    selectNextActivity: vi.fn(() => Promise.resolve()),
    retryLastSave: vi.fn(() => Promise.resolve()),
    registerPersistenceHandle: vi.fn(),
    registerPracticeHeading: vi.fn(),
    registerInlineHeading: vi.fn(),
    collapsePracticePane: vi.fn(),
    expandPracticePane: vi.fn(),
  } as unknown as LearningWorkspaceController;
  render(
    <PracticePane
      owner={{ courseId: 'course', ownerKind: 'lessons', ownerId: 'lesson' }}
      activities={activities}
      statuses={[
        {
          activityId: 'Coding',
          status: 'PASSED',
          attemptNumber: 1,
          score: 1,
          maxScore: 1,
          passed: true,
        },
      ]}
      controller={controller}
      onProgressChanged={vi.fn()}
      renderHost={() => <input aria-label="active editor" />}
    />,
  );
  expect(screen.getByTestId('practice-completion-status')).toHaveTextContent(
    'Tất cả hoạt động trong bài đã hoàn thành',
  );
  expect(screen.getByTestId('practice-footer-actions')).not.toContainElement(
    screen.getByTestId('practice-completion-status'),
  );
});
