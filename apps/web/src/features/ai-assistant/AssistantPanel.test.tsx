import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AppProviders } from '#src/app/providers/AppProviders';
import { AssistantPanel } from '#src/features/ai-assistant/AssistantPanel';
import type { SynaploomApiClient } from '#src/shared/api/client';

it('keeps activity context in the request while showing lesson-level copy', async () => {
  const requestAi = vi.fn(() =>
    Promise.resolve({ status: 'disabled' as const, message: 'AI disabled' }),
  );
  const api = { requestAi } as unknown as SynaploomApiClient;

  render(
    <AppProviders api={api}>
      <AssistantPanel lessonTitle="Dòng chảy thuật toán" activityTitle="Sắp xếp thuật toán" />
    </AppProviders>,
  );

  const input = screen.getByRole('textbox', { name: 'Câu hỏi cho Trợ lý AI' });
  expect(input).toHaveAttribute('placeholder', 'Đặt câu hỏi về bài học này…');
  expect(screen.queryByText('Hoạt động: Sắp xếp thuật toán')).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Trợ lý AI' })).toHaveClass('syn-assistant-context');
  expect(screen.getByRole('region', { name: 'Trợ lý AI' })).toHaveAttribute(
    'data-assistant-dock-surface',
  );

  fireEvent.change(input, { target: { value: 'Giải thích bước này' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' }));

  await waitFor(() =>
    expect(requestAi).toHaveBeenCalledWith({
      kind: 'explain',
      prompt: 'Hoạt động: Sắp xếp thuật toán. Giải thích bước này',
    }),
  );
});

it('uses lesson-level copy without a focused activity', () => {
  const api = {
    requestAi: () => Promise.resolve({ status: 'disabled', message: 'AI disabled' }),
  } as unknown as SynaploomApiClient;
  render(
    <AppProviders api={api}>
      <AssistantPanel lessonTitle="Dòng chảy thuật toán" />
    </AppProviders>,
  );
  expect(screen.getByRole('textbox', { name: 'Câu hỏi cho Trợ lý AI' })).toHaveAttribute(
    'placeholder',
    'Đặt câu hỏi về bài học này…',
  );
  expect(screen.queryByText('Bài học: Dòng chảy thuật toán')).not.toBeInTheDocument();
});
