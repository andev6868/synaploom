import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  AssistantInvocation,
  ContextualAssistantController,
} from '#src/features/ai-assistant/contextual-assistant-model';
import {
  AssistantQuickPopover,
  assistantPopoverPosition,
} from '#src/features/ai-assistant/AssistantQuickPopover';

function controllerFor(invocation: AssistantInvocation): {
  readonly controller: ContextualAssistantController;
  readonly close: ReturnType<typeof vi.fn>;
  readonly submit: ReturnType<typeof vi.fn>;
} {
  const close = vi.fn();
  const submit = vi.fn(() => Promise.resolve());
  return {
    close,
    submit,
    controller: {
      target: { courseId: 'course', ownerKind: 'lessons', ownerId: 'lesson' },
      state: { kind: 'quick', invocation },
      prompt: '',
      messages: [],
      response: null,
      status: 'idle',
      error: null,
      openQuick: vi.fn(),
      expand: vi.fn(),
      close,
      setPrompt: vi.fn(),
      submit,
    },
  };
}

function controllerWithState(
  invocation: AssistantInvocation,
  overrides: Partial<ContextualAssistantController>,
): ContextualAssistantController {
  return { ...controllerFor(invocation).controller, ...overrides };
}

describe('AssistantQuickPopover', () => {
  it('keeps Theory Quick Ask inside the Theory pane boundary', () => {
    const boundary = new DOMRect(0, 50, 500, 700);
    const anchor = new DOMRect(400, 180, 72, 32);

    const position = assistantPopoverPosition(anchor, boundary, 'theory');

    expect(position.left).toBeGreaterThanOrEqual(boundary.left + 12);
    expect(position.left + position.width).toBeLessThanOrEqual(boundary.right - 12);
    expect(position.top).toBeGreaterThanOrEqual(anchor.bottom);
  });

  it('keeps Practice Quick Ask inside the Practice pane boundary', () => {
    const boundary = new DOMRect(500, 50, 720, 700);
    const anchor = new DOMRect(1110, 110, 72, 32);

    const position = assistantPopoverPosition(anchor, boundary, 'practice');

    expect(position.left).toBeGreaterThanOrEqual(boundary.left + 12);
    expect(position.left + position.width).toBeLessThanOrEqual(boundary.right - 12);
    expect(position.top).toBeGreaterThanOrEqual(anchor.bottom);
  });
  it('renders Theory actions and submits without closing', () => {
    const { controller, close, submit } = controllerFor({
      source: 'theory',
      sectionTitle: 'Thuật toán là gì?',
      anchor: new DOMRect(100, 80, 120, 30),
    });

    render(<AssistantQuickPopover controller={controller} />);

    expect(screen.getByRole('dialog', { name: 'Trợ lý AI' })).toBeVisible();
    expect(screen.getByText('Lý thuyết · Thuật toán là gì?')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Xem gợi ý' }));
    expect(screen.getByRole('button', { name: 'Giải thích' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cho ví dụ' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Tóm tắt' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Giải thích' }));
    expect(submit).toHaveBeenCalledWith(
      'explain',
      'Giải thích nội dung này bằng ngôn ngữ dễ hiểu.',
    );
    expect(close).not.toHaveBeenCalled();
  });

  it('renders the compact conversation preview, action cards, and icon-led composer', () => {
    const { controller } = controllerFor({
      source: 'theory',
      sectionTitle: 'Thuật toán là gì?',
      anchor: new DOMRect(100, 80, 120, 30),
    });

    render(<AssistantQuickPopover controller={controller} />);

    const popover = screen.getByTestId('assistant-quick-popover');
    expect(popover.querySelector('[data-assistant-quick-avatar]')).toBeInTheDocument();
    expect(screen.getByText('Mình có thể giúp gì cho bạn?')).toBeVisible();
    expect(screen.getByText('Giải thích dòng chảy thuật toán')).toBeVisible();
    expect(screen.getByText('Mình sẽ giải thích ngắn gọn và dễ hiểu.')).toBeVisible();
    expect(screen.queryByTestId('assistant-quick-actions')).not.toBeInTheDocument();

    const reveal = screen.getByRole('button', { name: 'Xem gợi ý' });
    expect(reveal).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(reveal);

    const actions = screen.getByLabelText('Các gợi ý của Trợ lý AI');
    expect(actions).toHaveAttribute('data-testid', 'assistant-quick-actions');
    expect(screen.getByRole('button', { name: 'Giải thích' })).toHaveTextContent(
      'Giải thích khái niệm',
    );
    expect(screen.getByRole('button', { name: 'Cho ví dụ' })).toHaveTextContent('Ví dụ minh hoạ');
    expect(screen.getByRole('button', { name: 'Tóm tắt' })).toHaveTextContent('Tóm tắt nội dung');
    expect(screen.getByRole('button', { name: 'Mở cuộc hội thoại đầy đủ' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Gửi' })).toBeDisabled();
  });

  it('shows the latest user and assistant messages as chat bubbles', () => {
    const invocation: AssistantInvocation = {
      source: 'theory',
      sectionTitle: 'Thuật toán là gì?',
      anchor: new DOMRect(100, 80, 120, 30),
    };

    render(
      <AssistantQuickPopover
        controller={controllerWithState(invocation, {
          messages: [
            {
              id: 'user-1',
              role: 'user',
              content: 'Giải thích dòng chảy thuật toán',
              source: 'theory',
              contextLabel: 'Lý thuyết',
            },
            {
              id: 'assistant-1',
              role: 'assistant',
              content: 'Mình sẽ giải thích ngắn gọn và dễ hiểu.',
              source: 'theory',
              contextLabel: 'Lý thuyết',
            },
          ],
        })}
      />,
    );

    const messages = screen.getByLabelText('Tóm tắt cuộc hội thoại');
    expect(messages).toHaveTextContent('Giải thích dòng chảy thuật toán');
    expect(messages).toHaveTextContent('Mình sẽ giải thích ngắn gọn và dễ hiểu.');
    expect(messages.querySelector('[data-role="user"]')).toBeInTheDocument();
    expect(messages.querySelector('[data-role="assistant"]')).toBeInTheDocument();
    expect(screen.queryByTestId('assistant-quick-actions')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Xem gợi ý' }));
    expect(screen.getByTestId('assistant-quick-actions')).toBeVisible();
  });

  it('renders Practice actions and selected item context', () => {
    const { controller } = controllerFor({
      source: 'practice',
      activityId: 'ordering',
      activityTitle: 'Sắp xếp thuật toán',
      selectedText: 'Hiển thị kết quả',
      anchor: new DOMRect(200, 120, 140, 30),
    });

    render(<AssistantQuickPopover controller={controller} />);

    expect(screen.getByText('Bước được chọn · Sắp xếp thuật toán')).toBeVisible();
    expect(screen.getByText('Hiển thị kết quả')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Xem gợi ý' }));
    expect(screen.getByRole('button', { name: 'Gợi ý' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Giải thích lỗi' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Kiểm tra cách làm' })).toBeVisible();
  });

  it('announces disabled and error lifecycle states without enabling repeated submit', () => {
    const invocation: AssistantInvocation = {
      source: 'theory',
      sectionTitle: 'Thuật toán là gì?',
      anchor: new DOMRect(100, 80, 120, 30),
    };
    const { rerender } = render(
      <AssistantQuickPopover
        controller={controllerWithState(invocation, {
          prompt: 'Câu hỏi chưa gửi được',
          response: 'Trợ lý AI chưa được cấu hình.',
          status: 'disabled',
        })}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Trợ lý AI chưa được cấu hình.');
    expect(screen.getByRole('textbox', { name: 'Câu hỏi' })).toHaveValue('Câu hỏi chưa gửi được');

    rerender(
      <AssistantQuickPopover
        controller={controllerWithState(invocation, {
          prompt: 'Câu hỏi chưa gửi được',
          status: 'error',
          error: 'Không thể gửi câu hỏi. Hãy thử lại.',
        })}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Không thể gửi câu hỏi. Hãy thử lại.');

    rerender(
      <AssistantQuickPopover
        controller={controllerWithState(invocation, {
          prompt: 'Đang gửi',
          status: 'submitting',
        })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Gửi' })).toBeDisabled();
  });
});
