import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { AppProviders } from '#src/app/providers/AppProviders';
import { AssistantPanel } from '#src/features/ai-assistant/AssistantPanel';
import type { SynaploomApiClient } from '#src/shared/api/client';

const api = {
  requestAi: () => Promise.resolve({ status: 'disabled', message: 'AI disabled' }),
} as unknown as SynaploomApiClient;

it('shows activity context when Practice has focus', () => {
  render(
    <AppProviders api={api}>
      <AssistantPanel lessonTitle="Dòng chảy thuật toán" activityTitle="Sắp xếp thuật toán" />
    </AppProviders>,
  );
  expect(screen.getByText('Hoạt động: Sắp xếp thuật toán')).toHaveClass(
    'syn-assistant-dock__context',
  );
  expect(screen.getByRole('region', { name: 'Trợ lý AI' })).toHaveClass('syn-assistant-context');
  expect(screen.getByRole('region', { name: 'Trợ lý AI' })).toHaveAttribute(
    'data-assistant-dock-surface',
  );
  expect(screen.getByRole('textbox', { name: 'Câu hỏi cho Trợ lý AI' })).toHaveAttribute(
    'placeholder',
    'Đặt câu hỏi về hoạt động này…',
  );
  expect(screen.getByRole('button', { name: 'Gửi câu hỏi' })).toBeDisabled();
});

it('falls back to lesson context without a focused activity', () => {
  render(
    <AppProviders api={api}>
      <AssistantPanel lessonTitle="Dòng chảy thuật toán" />
    </AppProviders>,
  );
  expect(screen.getByText('Bài học: Dòng chảy thuật toán')).toBeVisible();
});
