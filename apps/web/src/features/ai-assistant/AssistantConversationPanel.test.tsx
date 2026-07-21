import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ContextualAssistantController } from '#src/features/ai-assistant/contextual-assistant-model';
import { AssistantConversationPanel } from '#src/features/ai-assistant/AssistantConversationPanel';

function expandedController(
  overrides: Partial<ContextualAssistantController> = {},
): {
  readonly controller: ContextualAssistantController;
  readonly close: ReturnType<typeof vi.fn>;
  readonly setPrompt: ReturnType<typeof vi.fn>;
  readonly submit: ReturnType<typeof vi.fn>;
} {
  const close = vi.fn();
  const setPrompt = vi.fn();
  const submit = vi.fn(() => Promise.resolve());
  return {
    close,
    setPrompt,
    submit,
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
      submit,
      ...overrides,
    },
  };
}

describe('AssistantConversationPanel', () => {
  it('renders the display-only starter conversation and submits its contextual suggestion', () => {
    const { controller, submit } = expandedController({
      prompt: '',
      messages: [],
      state: {
        kind: 'expanded',
        invocation: {
          source: 'theory',
          sectionTitle: 'Dòng chảy thuật toán',
          anchor: new DOMRect(),
        },
      },
    });
    render(<AssistantConversationPanel controller={controller} mobile={false} compact={false} />);

    expect(screen.getByText('Mình có thể giúp gì cho bạn? 👋')).toBeVisible();
    expect(
      screen.getByText('Hãy đặt câu hỏi để bắt đầu cuộc hội thoại theo ngữ cảnh hiện tại.'),
    ).toBeVisible();
    expect(screen.getByTestId('assistant-expanded-actions')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Giải thích' }));
    expect(submit).toHaveBeenCalledWith(
      'explain',
      'Giải thích nội dung này bằng ngôn ngữ dễ hiểu.',
    );
  });

  it('replaces starter content with live messages and hides suggestions', () => {
    const { controller } = expandedController();
    render(<AssistantConversationPanel controller={controller} mobile={false} compact={false} />);

    expect(screen.getByText('Vì sao bước này sai?')).toBeVisible();
    expect(screen.queryByTestId('assistant-expanded-actions')).not.toBeInTheDocument();
    expect(screen.queryByText('Mình có thể giúp gì cho bạn? 👋')).not.toBeInTheDocument();
  });

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

  it('renders inside the existing mobile modal layer without creating a second portal dialog', () => {
    const host = document.createElement('div');
    host.setAttribute('data-testid', 'mobile-modal-host');
    document.body.append(host);
    const { controller, close } = expandedController();
    const view = render(
      <AssistantConversationPanel controller={controller} mobile compact={false} />,
      { container: host },
    );

    const assistant = screen.getByRole('dialog', { name: 'Trợ lý AI' });
    expect(host).toContainElement(assistant);
    expect(document.querySelectorAll('.syn-dialog__overlay')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Đóng Trợ lý AI' }));
    expect(close).toHaveBeenCalledTimes(1);
    view.unmount();
    host.remove();
  });

  it('renders localized lifecycle feedback while preserving the conversation prompt', () => {
    const { controller } = expandedController();
    render(
      <AssistantConversationPanel
        controller={{
          ...controller,
          status: 'error',
          error: 'Không thể gửi câu hỏi. Hãy thử lại.',
        }}
        mobile={false}
        compact={false}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Không thể gửi câu hỏi. Hãy thử lại.');
    expect(screen.getByRole('textbox', { name: 'Tiếp tục cuộc hội thoại' })).toHaveValue(
      'Giải thích bước này',
    );
  });
});
