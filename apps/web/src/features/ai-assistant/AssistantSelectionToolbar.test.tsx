import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AssistantSelectionToolbar } from '#src/features/ai-assistant/AssistantSelectionToolbar';

it('offers pointer and keyboard access to ask about the selected Theory text', () => {
  const onAsk = vi.fn();
  const rect = new DOMRect(120, 180, 240, 24);

  render(<AssistantSelectionToolbar selection={{ text: 'Đoạn lý thuyết', rect }} onAsk={onAsk} />);

  const button = screen.getByRole('button', { name: 'Hỏi AI về đoạn lý thuyết đã chọn' });
  expect(button).toHaveTextContent('Hỏi AI về đoạn này');
  expect(screen.getAllByRole('button')).toHaveLength(1);
  expect(button).toBeVisible();
  fireEvent.click(button);
  expect(onAsk).toHaveBeenCalledWith(rect);
});
