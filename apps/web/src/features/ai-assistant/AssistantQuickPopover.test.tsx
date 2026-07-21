import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  AssistantInvocation,
  ContextualAssistantController,
} from '#src/features/ai-assistant/contextual-assistant-model';
import { AssistantQuickPopover } from '#src/features/ai-assistant/AssistantQuickPopover';

function controllerFor(invocation: AssistantInvocation): ContextualAssistantController {
  return {
    target: { courseId: 'course', ownerKind: 'lessons', ownerId: 'lesson' },
    state: { kind: 'quick', invocation },
    prompt: '',
    messages: [],
    response: null,
    status: 'idle',
    error: null,
    openQuick: vi.fn(),
    expand: vi.fn(),
    close: vi.fn(),
    setPrompt: vi.fn(),
    submit: vi.fn(() => Promise.resolve()),
  };
}

describe('AssistantQuickPopover', () => {
  it('renders Theory actions and submits without closing', () => {
    const controller = controllerFor({
      source: 'theory',
      sectionTitle: 'Thuật toán là gì?',
      anchor: new DOMRect(100, 80, 120, 30),
    });

    render(<AssistantQuickPopover controller={controller} />);

    expect(screen.getByRole('dialog', { name: 'Trợ lý AI' })).toBeVisible();
    expect(screen.getByText('Lý thuyết · Thuật toán là gì?')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Giải thích' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cho ví dụ' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Tóm tắt' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Giải thích' }));
    expect(controller.submit).toHaveBeenCalledWith(
      'explain',
      'Giải thích nội dung này bằng ngôn ngữ dễ hiểu.',
    );
    expect(controller.close).not.toHaveBeenCalled();
  });

  it('renders Practice actions and selected item context', () => {
    const controller = controllerFor({
      source: 'practice',
      activityId: 'ordering',
      activityTitle: 'Sắp xếp thuật toán',
      selectedText: 'Hiển thị kết quả',
      anchor: new DOMRect(200, 120, 140, 30),
    });

    render(<AssistantQuickPopover controller={controller} />);

    expect(screen.getByText('Bước được chọn · Sắp xếp thuật toán')).toBeVisible();
    expect(screen.getByText('Hiển thị kết quả')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Gợi ý' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Giải thích lỗi' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Kiểm tra cách làm' })).toBeVisible();
  });
});
