import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AssistantDock } from '#ui/components/assistant-dock/assistant-dock';

it('renders the complete compact assistant dock anatomy', () => {
  const onSubmit = vi.fn();
  render(
    <AssistantDock
      contextLabel="Hoạt động: Sắp xếp thuật toán"
      placeholder="Đặt câu hỏi về hoạt động này…"
      onSubmit={onSubmit}
      onRequest={vi.fn()}
    />,
  );

  expect(screen.getByText('Hoạt động: Sắp xếp thuật toán')).toBeVisible();
  const input = screen.getByRole('textbox', { name: 'Câu hỏi cho Trợ lý AI' });
  expect(input).toHaveAttribute('placeholder', 'Đặt câu hỏi về hoạt động này…');
  expect(screen.getByRole('button', { name: 'Gợi ý' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Giải thích' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Tóm tắt' })).toBeVisible();
  const send = screen.getByRole('button', { name: 'Gửi câu hỏi' });
  expect(send).toBeDisabled();
  fireEvent.change(input, { target: { value: 'Giải thích vòng lặp' } });
  expect(send).toBeEnabled();
  fireEvent.click(send);
  expect(onSubmit).toHaveBeenCalledWith('Giải thích vòng lặp');
});
