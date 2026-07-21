import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ContextualAssistantController } from '#src/features/ai-assistant/contextual-assistant-model';
import { AssistantConversationPanel } from '#src/features/ai-assistant/AssistantConversationPanel';

function expandedController(): {
  readonly controller: ContextualAssistantController;
  readonly close: ReturnType<typeof vi.fn>;
  readonly setPrompt: ReturnType<typeof vi.fn>;
} {
  const close = vi.fn();
  const setPrompt = vi.fn();
  return {
    close,
    setPrompt,
    controller: {
    target: { courseId: 'course', ownerKind: 'lessons', ownerId: 'lesson' },
    state: {
      kind: 'expanded',
      invocation: {
        source: 'practice',
        activityId: 'ordering',
        activityTitle: 'Sắp xếp thuật toán',
        anchor: new DOMRect(10, 10, 20, 20),
      },
    },
    prompt: 'Giải thích bước này',
    messages: [
      {
        id: 'user-1',
        role: 'user',
        content: 'Vì sao bước này sai?',
        source: 'practice',
        contextLabel: 'Bài tập · Sắp xếp thuật toán',
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        content: 'Cần tính trước khi hiển thị.',
        source: 'practice',
        contextLabel: 'Bài tập · Sắp xếp thuật toán',
      },
    ],
    response: null,
    status: 'idle',
    error: null,
    openQuick: vi.fn(),
    expand: vi.fn(),
    close,
    setPrompt,
    submit: vi.fn(() => Promise.resolve()),
    },
  };
}

describe('AssistantConversationPanel', () => {
  it('renders a desktop conversation overlay without losing prompt or context', () => {
    const { controller, setPrompt } = expandedController();
    render(<AssistantConversationPanel controller={controller} mobile={false} compact={false} />);

    expect(screen.getByRole('complementary', { name: 'Trợ lý AI' })).toHaveTextContent(
      'Bài tập · Sắp xếp thuật toán',
    );
    expect(screen.getByLabelText('Cuộc hội thoại')).toHaveTextContent('Vì sao bước này sai?');
    expect(screen.getByRole('textbox', { name: 'Tiếp tục cuộc hội thoại' })).toHaveValue(
      'Giải thích bước này',
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Tiếp tục cuộc hội thoại' }), {
      target: { value: 'Câu hỏi tiếp theo' },
    });
    expect(setPrompt).toHaveBeenCalledWith('Câu hỏi tiếp theo');
  });

  it('uses the focus-managed Dialog surface on mobile and closes through onOpenChange', () => {
    const { controller, close } = expandedController();
    render(<AssistantConversationPanel controller={controller} mobile compact={false} />);

    expect(screen.getByRole('dialog', { name: 'Trợ lý AI' })).toHaveAttribute('aria-modal', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(close).toHaveBeenCalledTimes(1);
  });
});
