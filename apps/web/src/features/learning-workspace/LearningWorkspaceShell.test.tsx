import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LearningWorkspaceShell } from '#src/features/learning-workspace/LearningWorkspaceShell';

function viewport(kind: 'wide-three' | 'wide-two' | 'compact' | 'mobile'): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    matches:
      kind === 'wide-three'
        ? query.includes('1440')
        : kind === 'wide-two'
          ? query.includes('1180') || query.includes('720')
          : kind === 'compact'
            ? query.includes('720')
            : false,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: () => true,
  }));
}
afterEach(() => vi.unstubAllGlobals());
const common = {
  splitRatio: 0.45,
  theory: <div data-testid="theory-surface">Theory content</div>,
  practice: <div data-testid="practice-surface">Practice editor</div>,
  practiceRail: <div data-testid="practice-rail">Practice rail</div>,
  theoryRail: <div>Theory rail</div>,
  practiceTitle: 'Practice',
  navigator: <div data-testid="navigator-surface">Navigator</div>,
  overlay: <div data-testid="assistant-overlay">Assistant</div>,
  onSplitRatioCommit: vi.fn(),
  onCloseMobilePractice: vi.fn(),
};

it('maps wide collapsed, split and expanded surfaces', () => {
  viewport('wide-three');
  const view = render(<LearningWorkspaceShell {...common} mode="collapsed" />);
  expect(screen.getByText('Theory content')).toBeVisible();
  expect(screen.getByRole('main')).toHaveClass('syn-learning-workspace--collapsed');
  expect(screen.getByTestId('practice-rail')).toBeVisible();
  expect(screen.queryByText('Practice editor')).not.toBeInTheDocument();
  view.rerender(<LearningWorkspaceShell {...common} mode="split" />);
  expect(screen.getByText('Practice editor')).toBeVisible();
  expect(screen.getByTestId('navigator-surface')).toBeVisible();
  expect(screen.getByTestId('workspace-navigator-zone')).toHaveAttribute(
    'id',
    'workspace-activity-navigator',
  );
  expect(screen.getByTestId('workspace-navigator-zone')).toHaveAttribute('tabindex', '-1');
  expect(screen.getByTestId('assistant-overlay')).toBeVisible();
  expect(screen.getByRole('separator', { name: 'Thay đổi kích thước hai vùng học' })).toBeVisible();
  view.rerender(<LearningWorkspaceShell {...common} mode="expanded" />);
  expect(screen.getByText('Practice editor')).toBeVisible();
  expect(screen.getByText('Theory rail')).toBeVisible();
  expect(screen.getByTestId('navigator-surface').parentElement).toHaveAttribute(
    'id',
    'workspace-activity-navigator',
  );
});

it('does not reserve a permanent navigator column at wide-two', () => {
  viewport('wide-two');
  render(<LearningWorkspaceShell {...common} mode="split" />);
  expect(screen.queryByTestId('workspace-navigator-zone')).not.toBeInTheDocument();
  expect(screen.getByText('Practice editor')).toBeVisible();
});

it('mounts overlays without reserving a workspace row', () => {
  viewport('wide-three');
  render(<LearningWorkspaceShell {...common} mode="split" />);
  expect(screen.getByTestId('assistant-overlay')).toBeVisible();
  expect(screen.getByTestId('workspace-main')).toBeVisible();
  expect(screen.queryByTestId('workspace-assistant')).not.toBeInTheDocument();
  expect(screen.getByTestId('workspace-layout')).toContainElement(
    screen.getByTestId('assistant-overlay'),
  );
});

it('uses local segmented controls on compact screens', () => {
  viewport('compact');
  render(<LearningWorkspaceShell {...common} mode="split" />);
  expect(screen.getByRole('button', { name: 'Lý thuyết' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Thực hành' }));
  expect(screen.getByText('Practice editor')).toBeVisible();
});

it('maps active mobile practice to a controlled dialog', () => {
  viewport('mobile');
  render(<LearningWorkspaceShell {...common} mode="split" />);
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(screen.getByText('Practice editor')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
  expect(common.onCloseMobilePractice).toHaveBeenCalled();
});

it('emits a sanitized viewport mapping event for the active owner', () => {
  viewport('wide-three');
  const listener = vi.fn();
  window.addEventListener('synaploom:workspace-event', listener);
  render(
    <LearningWorkspaceShell
      {...common}
      mode="collapsed"
      eventOwner={{ courseId: 'course', ownerKind: 'lessons', ownerId: 'lesson' }}
    />,
  );
  expect(listener).toHaveBeenCalled();
  expect((listener.mock.calls[0]?.[0] as CustomEvent).detail).toMatchObject({
    name: 'workspace.viewport.mapped',
    viewport: 'wide-three',
    ownerId: 'lesson',
  });
  window.removeEventListener('synaploom:workspace-event', listener);
});

it('mounts Practice once inside the mobile dialog', () => {
  viewport('mobile');
  render(<LearningWorkspaceShell {...common} mode="split" />);
  expect(screen.getAllByTestId('practice-surface')).toHaveLength(1);
  expect(screen.getByRole('dialog')).toContainElement(screen.getByTestId('practice-surface'));
});

it('keeps compact switching local without persisting split ratio', () => {
  viewport('compact');
  const onSplitRatioCommit = vi.fn();
  render(
    <LearningWorkspaceShell {...common} mode="split" onSplitRatioCommit={onSplitRatioCommit} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Thực hành' }));
  expect(screen.getByTestId('practice-surface')).toBeVisible();
  expect(onSplitRatioCommit).not.toHaveBeenCalled();
});

it('renders bounded Theory and Practice regions in wide split mode', () => {
  viewport('wide-three');
  render(<LearningWorkspaceShell {...common} mode="split" />);
  expect(screen.getByTestId('theory-surface').parentElement).toHaveClass(
    'syn-learning-workspace__theory',
  );
  expect(screen.getByTestId('practice-surface')).toBeVisible();
});

it('exposes bounded main and overlay composition hooks', () => {
  viewport('wide-three');
  render(<LearningWorkspaceShell {...common} mode="split" />);
  expect(screen.getByTestId('workspace-layout')).toContainElement(
    screen.getByTestId('workspace-main'),
  );
  expect(screen.getByTestId('workspace-layout')).toContainElement(
    screen.getByTestId('assistant-overlay'),
  );
  expect(screen.getByTestId('workspace-main')).toHaveAttribute('data-workspace-main');
});
