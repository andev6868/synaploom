import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LearningWorkspaceShell } from '#src/features/learning-workspace/LearningWorkspaceShell';

function viewport(kind: 'wide' | 'compact' | 'mobile'): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    matches:
      kind === 'wide' ? query.includes('1100') : kind === 'compact' ? query.includes('720') : false,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: () => true,
  }));
}
afterEach(() => vi.unstubAllGlobals());
const common = {
  splitRatio: 0.45,
  theory: <div>Theory content</div>,
  practice: <div>Practice editor</div>,
  practiceRail: <div>Practice rail</div>,
  theoryRail: <div>Theory rail</div>,
  practiceTitle: 'Practice',
  onSplitRatioCommit: vi.fn(),
  onCloseMobilePractice: vi.fn(),
};

it('maps wide collapsed, split and expanded surfaces', () => {
  viewport('wide');
  const view = render(<LearningWorkspaceShell {...common} mode="collapsed" />);
  expect(screen.getByText('Theory content')).toBeVisible();
  expect(screen.getByText('Practice rail')).toBeVisible();
  expect(screen.queryByText('Practice editor')).not.toBeInTheDocument();
  view.rerender(<LearningWorkspaceShell {...common} mode="split" />);
  expect(screen.getByText('Practice editor')).toBeVisible();
  expect(screen.getByRole('separator', { name: 'Thay đổi kích thước hai vùng học' })).toBeVisible();
  view.rerender(<LearningWorkspaceShell {...common} mode="expanded" />);
  expect(screen.getByText('Practice editor')).toBeVisible();
  expect(screen.getByText('Theory rail')).toBeVisible();
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
