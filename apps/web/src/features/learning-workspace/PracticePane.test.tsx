import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
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

function viewport(kind: 'wide-three' | 'wide-two'): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    matches:
      kind === 'wide-three'
        ? query.includes('1440')
        : query.includes('1180') || query.includes('720'),
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: () => true,
  }));
}

afterEach(() => vi.unstubAllGlobals());

it('mounts exactly one focused host and exposes explicit next and retry actions', () => {
  const selectNextActivity = vi.fn(() => Promise.resolve());
  const retryLastSave = vi.fn(() => Promise.resolve());
  const onAskPractice = vi.fn();
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
      onAskPractice={onAskPractice}
      renderHost={() => <input aria-label="active editor" />}
    />,
  );
  expect(screen.getByLabelText('Khu vực thực hành')).toHaveClass('syn-practice-pane');
  expect(screen.getByLabelText('Khu vực thực hành')).toHaveAttribute('data-practice-surface');
  expect(screen.getByTestId('practice-workspace-card')).toHaveClass('syn-practice-workspace-card');
  expect(screen.getByTestId('practice-workspace-content')).toContainElement(
    screen.getByRole('textbox', { name: 'active editor' }),
  );
  expect(screen.getByTestId('practice-workspace-content').children).toHaveLength(1);
  expect(screen.getByTestId('practice-workspace-content').firstElementChild).toHaveClass(
    'syn-practice-pane__body',
  );
  expect(screen.getByTestId('practice-workspace-footer')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Danh sách hoạt động' })).toBeVisible();
  const askButton = screen.getByRole('button', { name: 'Hỏi AI về bài tập đang làm' });
  expect(askButton).toBeVisible();
  fireEvent.click(askButton);
  expect(onAskPractice).toHaveBeenCalledWith(
    expect.objectContaining({
      source: 'practice',
      activityId: 'Quiz',
      activityTitle: 'Quiz',
      anchor: askButton,
    }),
  );
  expect(screen.getByTestId('practice-header-controls')).toContainElement(
    screen.getByRole('button', { name: 'Danh sách hoạt động' }),
  );
  expect(screen.getByTestId('practice-active-status')).toHaveTextContent('Đang làm');
  expect(screen.getByTestId('practice-save-status')).toHaveTextContent('Lưu thất bại');
  expect(screen.getByTestId('practice-footer-status')).toBeVisible();
  expect(screen.getByTestId('practice-footer-actions')).toBeVisible();
  expect(screen.queryByText('Hoạt động trong bài')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Quiz', level: 2 })).toHaveAttribute('tabindex', '-1');
  expect(screen.getAllByRole('textbox', { name: 'active editor' })).toHaveLength(1);
  expect(screen.getByText('Lưu thất bại')).toBeVisible();
  expect(screen.getByText('1/2')).toBeVisible();
  expect(screen.getByText('1/2')).toBeVisible();
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Không thể lưu thay đổi khu vực học. Vui lòng thử lại.',
  );
  expect(screen.getByRole('alert')).not.toHaveTextContent('save failed');
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
      onAskPractice={vi.fn()}
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

it('does not report a draft from workspace-presentation save status alone', () => {
  const controller = {
    focusedActivity: activities[0],
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
      statuses={[]}
      controller={controller}
      onProgressChanged={vi.fn()}
      onAskPractice={vi.fn()}
      renderHost={() => <input aria-label="active editor" />}
    />,
  );

  expect(screen.getByTestId('practice-footer-status')).toHaveTextContent('Sẵn sàng');
  expect(screen.getByTestId('practice-footer-status')).not.toHaveTextContent('Đã lưu bản nháp');
});

it('shows a deterministic local save time when the focused status transitions into DRAFT', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-20T07:32:00Z'));
  try {
    const controller = {
      focusedActivity: activities[0],
      state: { paneMode: 'split' },
      saveStatus: 'idle',
      error: null,
      selectNextActivity: vi.fn(() => Promise.resolve()),
      retryLastSave: vi.fn(() => Promise.resolve()),
      registerPersistenceHandle: vi.fn(),
      registerPracticeHeading: vi.fn(),
      registerInlineHeading: vi.fn(),
      collapsePracticePane: vi.fn(),
      expandPracticePane: vi.fn(),
      focusActivity: vi.fn(),
    } as unknown as LearningWorkspaceController;
    const view = render(
      <PracticePane
        owner={{ courseId: 'course', ownerKind: 'lessons', ownerId: 'lesson' }}
        activities={activities}
        statuses={[]}
        controller={controller}
        onProgressChanged={vi.fn()}
        onAskPractice={vi.fn()}
        renderHost={() => <input aria-label="active editor" />}
      />,
    );
    expect(screen.getByTestId('practice-footer-status')).toHaveTextContent('Sẵn sàng');

    view.rerender(
      <PracticePane
        owner={{ courseId: 'course', ownerKind: 'lessons', ownerId: 'lesson' }}
        activities={activities}
        statuses={[
          {
            activityId: 'Quiz',
            status: 'DRAFT',
            attemptNumber: 0,
            score: null,
            maxScore: 1,
            passed: false,
          },
        ]}
        controller={controller}
        onProgressChanged={vi.fn()}
        onAskPractice={vi.fn()}
        renderHost={() => <input aria-label="active editor" />}
      />,
    );

    expect(screen.getByTestId('practice-footer-status')).toHaveTextContent(
      'Đã lưu bản nháp lúc 14:32',
    );
  } finally {
    vi.useRealTimers();
  }
});

it('does not fabricate a save time when a historical draft is loaded', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-20T07:32:00Z'));
  try {
    const controller = {
      focusedActivity: activities[0],
      state: { paneMode: 'split' },
      saveStatus: 'idle',
      error: null,
      selectNextActivity: vi.fn(() => Promise.resolve()),
      retryLastSave: vi.fn(() => Promise.resolve()),
      registerPersistenceHandle: vi.fn(),
      registerPracticeHeading: vi.fn(),
      registerInlineHeading: vi.fn(),
      collapsePracticePane: vi.fn(),
      expandPracticePane: vi.fn(),
      focusActivity: vi.fn(),
    } as unknown as LearningWorkspaceController;

    render(
      <PracticePane
        owner={{ courseId: 'course', ownerKind: 'lessons', ownerId: 'lesson' }}
        activities={activities}
        statuses={[
          {
            activityId: 'Quiz',
            status: 'DRAFT',
            attemptNumber: 0,
            score: null,
            maxScore: 1,
            passed: false,
          },
        ]}
        controller={controller}
        onProgressChanged={vi.fn()}
        onAskPractice={vi.fn()}
        renderHost={() => <input aria-label="active editor" />}
      />,
    );

    expect(screen.getByTestId('practice-footer-status')).toHaveTextContent('Đã lưu bản nháp');
    expect(screen.getByTestId('practice-footer-status')).not.toHaveTextContent('14:32');
  } finally {
    vi.useRealTimers();
  }
});

it('uses the permanent navigator at wide-three without opening a duplicate drawer', () => {
  viewport('wide-three');
  const permanentNavigator = document.createElement('aside');
  permanentNavigator.id = 'workspace-activity-navigator';
  permanentNavigator.tabIndex = -1;
  document.body.append(permanentNavigator);
  try {
    const controller = {
      focusedActivity: activities[0],
      state: { paneMode: 'split' },
      saveStatus: 'idle',
      error: null,
      selectNextActivity: vi.fn(() => Promise.resolve()),
      retryLastSave: vi.fn(() => Promise.resolve()),
      registerPersistenceHandle: vi.fn(),
      registerPracticeHeading: vi.fn(),
      registerInlineHeading: vi.fn(),
      collapsePracticePane: vi.fn(),
      expandPracticePane: vi.fn(),
      focusActivity: vi.fn(() => Promise.resolve()),
    } as unknown as LearningWorkspaceController;

    render(
      <PracticePane
        owner={{ courseId: 'course', ownerKind: 'lessons', ownerId: 'lesson' }}
        activities={activities}
        statuses={[]}
        controller={controller}
        onProgressChanged={vi.fn()}
        onAskPractice={vi.fn()}
        renderHost={() => <input aria-label="active editor" />}
      />,
    );

    const button = screen.getByRole('button', { name: 'Danh sách hoạt động' });
    expect(button).toHaveAttribute('aria-controls', 'workspace-activity-navigator');
    fireEvent.click(button);
    expect(screen.queryByRole('dialog', { name: 'Danh sách hoạt động' })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(permanentNavigator);
  } finally {
    permanentNavigator.remove();
  }
});

it('opens the activity drawer at wide-two where no permanent navigator exists', () => {
  viewport('wide-two');
  const controller = {
    focusedActivity: activities[0],
    state: { paneMode: 'split' },
    saveStatus: 'idle',
    error: null,
    selectNextActivity: vi.fn(() => Promise.resolve()),
    retryLastSave: vi.fn(() => Promise.resolve()),
    registerPersistenceHandle: vi.fn(),
    registerPracticeHeading: vi.fn(),
    registerInlineHeading: vi.fn(),
    collapsePracticePane: vi.fn(),
    expandPracticePane: vi.fn(),
    focusActivity: vi.fn(() => Promise.resolve()),
  } as unknown as LearningWorkspaceController;

  render(
    <PracticePane
      owner={{ courseId: 'course', ownerKind: 'lessons', ownerId: 'lesson' }}
      activities={activities}
      statuses={[]}
      controller={controller}
      onProgressChanged={vi.fn()}
      onAskPractice={vi.fn()}
      renderHost={() => <input aria-label="active editor" />}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Danh sách hoạt động' }));
  expect(screen.getByRole('dialog', { name: 'Danh sách hoạt động' })).toBeVisible();
});

it('derives the saved-draft label from activity status instead of workspace save status', () => {
  const controller = {
    focusedActivity: activities[0],
    state: { paneMode: 'split' },
    saveStatus: 'idle',
    error: null,
    selectNextActivity: vi.fn(() => Promise.resolve()),
    retryLastSave: vi.fn(() => Promise.resolve()),
    registerPersistenceHandle: vi.fn(),
    registerPracticeHeading: vi.fn(),
    registerInlineHeading: vi.fn(),
    collapsePracticePane: vi.fn(),
    expandPracticePane: vi.fn(),
    focusActivity: vi.fn(() => Promise.resolve()),
  } as unknown as LearningWorkspaceController;

  render(
    <PracticePane
      owner={{ courseId: 'course', ownerKind: 'lessons', ownerId: 'lesson' }}
      activities={activities}
      statuses={[
        {
          activityId: 'Quiz',
          status: 'DRAFT',
          attemptNumber: 0,
          score: null,
          maxScore: 1,
          passed: false,
        },
      ]}
      controller={controller}
      onProgressChanged={vi.fn()}
      onAskPractice={vi.fn()}
      renderHost={() => <input aria-label="active editor" />}
    />,
  );

  expect(screen.getByTestId('practice-active-status')).toHaveTextContent('Đang làm');
  expect(screen.getByTestId('practice-save-status')).toHaveTextContent('Đã lưu bản nháp');
});
