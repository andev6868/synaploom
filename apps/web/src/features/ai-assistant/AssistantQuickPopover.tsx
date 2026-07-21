import {
  Bot,
  Maximize2,
  SendHorizontal,
  X,
} from 'lucide-react';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { assistantActionsForInvocation } from '#src/features/ai-assistant/assistant-actions';
import { AssistantContextBadge } from '#src/features/ai-assistant/AssistantContextBadge';
import type {
  AssistantInvocation,
  AssistantMessage,
  ContextualAssistantController,
} from '#src/features/ai-assistant/contextual-assistant-model';

export function assistantPopoverPosition(
  anchor: DOMRect,
  boundary: DOMRect,
  source: AssistantInvocation['source'],
): { readonly left: number; readonly top: number; readonly width: number } {
  const gap = 8;
  const edge = 12;
  const width = Math.min(420, Math.max(320, boundary.width - edge * 2));
  const minimumLeft = boundary.left + edge;
  const maximumLeft = Math.max(minimumLeft, boundary.right - width - edge);
  const preferredLeft =
    source === 'theory' ? anchor.right - width : Math.min(anchor.left, anchor.right - width);
  const left = Math.min(Math.max(minimumLeft, preferredLeft), maximumLeft);
  const below = anchor.bottom + gap;
  const above = anchor.top - gap - 320;
  const top = below + 320 <= boundary.bottom - edge ? below : Math.max(boundary.top + edge, above);
  return { left, top, width };
}

type QuickPreviewMessage = Pick<AssistantMessage, 'id' | 'role' | 'content'>;

const mockPreviewMessages: readonly QuickPreviewMessage[] = [
  {
    id: 'mock-assistant-greeting',
    role: 'assistant',
    content: 'Mình có thể giúp gì cho bạn?',
  },
  {
    id: 'mock-user-question',
    role: 'user',
    content: 'Giải thích dòng chảy thuật toán',
  },
  {
    id: 'mock-assistant-answer',
    role: 'assistant',
    content: 'Mình sẽ giải thích ngắn gọn và dễ hiểu.',
  },
];

function quickPreviewMessages(
  controller: ContextualAssistantController,
): readonly QuickPreviewMessage[] {
  if (controller.messages.length > 0) return controller.messages.slice(-2);
  return controller.response
    ? [{ id: 'assistant-response', role: 'assistant', content: controller.response }]
    : mockPreviewMessages;
}

export function AssistantQuickPopover({
  controller,
}: {
  readonly controller: ContextualAssistantController;
}): ReactNode {
  const [revealedForState, setRevealedForState] = useState<
    ContextualAssistantController['state'] | null
  >(null);

  if (controller.state.kind !== 'quick') return null;
  const invocation = controller.state.invocation;
  const anchorRect =
    invocation.anchor instanceof HTMLElement
      ? invocation.anchor.getBoundingClientRect()
      : invocation.anchor;
  const boundarySelector =
    invocation.source === 'theory' ? '[data-workspace-theory-zone]' : '[data-practice-surface]';
  const boundaryRect =
    document.querySelector<HTMLElement>(boundarySelector)?.getBoundingClientRect() ??
    document.querySelector<HTMLElement>('[data-workspace-main]')?.getBoundingClientRect() ??
    new DOMRect(0, 0, window.innerWidth, window.innerHeight);
  const position = assistantPopoverPosition(anchorRect, boundaryRect, invocation.source);
  const pending = controller.status === 'submitting';
  const actions = assistantActionsForInvocation(invocation);
  const previewMessages = quickPreviewMessages(controller);
  const actionsRevealed = revealedForState === controller.state;
  const showActions = previewMessages.length === 0 || actionsRevealed;
  const style = {
    left: position.left,
    top: position.top,
    width: position.width,
  } satisfies CSSProperties;

  return (
    <section
      className="syn-contextual-assistant-popover"
      data-testid="assistant-quick-popover"
      role="dialog"
      aria-label="Trợ lý AI"
      style={style}
    >
      <header className="syn-contextual-assistant-popover__header">
        <span
          className="syn-contextual-assistant-popover__avatar"
          data-assistant-quick-avatar
          aria-hidden="true"
        >
          <Bot size={20} strokeWidth={2.25} />
        </span>
        <div className="syn-contextual-assistant-popover__identity">
          <strong>Trợ lý AI</strong>
          <AssistantContextBadge invocation={invocation} />
        </div>
        <button
          type="button"
          className="syn-contextual-assistant__expand"
          aria-label="Mở cuộc hội thoại đầy đủ"
          onClick={() => controller.expand()}
        >
          <Maximize2 aria-hidden="true" size={8} />
        </button>
        <button
          type="button"
          className="syn-contextual-assistant__close"
          aria-label="Đóng Trợ lý AI"
          onClick={() => controller.close()}
        >
          <X aria-hidden="true" size={8} />
        </button>
      </header>
      <div className="syn-contextual-assistant-popover__body">
        {invocation.selectedText ? (
          <blockquote>{invocation.selectedText.slice(0, 240)}</blockquote>
        ) : null}
        <div
          className="syn-contextual-assistant-popover__messages"
          aria-label="Tóm tắt cuộc hội thoại"
        >
          {previewMessages.length === 0 ? (
            <article data-role="assistant">
              <p>Mình có thể giúp gì cho bạn?</p>
            </article>
          ) : (
            previewMessages.map((message) => (
              <article key={message.id} data-role={message.role}>
                <p>{message.content}</p>
              </article>
            ))
          )}
        </div>
        {showActions ? (
          <div
            id="assistant-quick-actions"
            className="syn-contextual-assistant-popover__actions"
            data-testid="assistant-quick-actions"
            aria-label="Các gợi ý của Trợ lý AI"
          >
            {actions.map(({ label, description, kind, prompt, icon: Icon }) => (
              <button
                key={label}
                type="button"
                aria-label={label}
                disabled={pending}
                onClick={() => void controller.submit(kind, prompt)}
              >
                <span className="syn-contextual-assistant-popover__action-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            className="syn-contextual-assistant-popover__show-actions"
            aria-expanded={actionsRevealed}
            aria-controls="assistant-quick-actions"
            onClick={() => setRevealedForState(controller.state)}
          >
            Xem gợi ý
          </button>
        )}
      </div>
      <footer className="syn-contextual-assistant-popover__footer">
        <div className="syn-contextual-assistant-popover__status" aria-live="polite" role="status">
          {pending
            ? 'Đang tạo câu trả lời…'
            : controller.status === 'disabled'
              ? controller.response
              : null}
        </div>
        {controller.error ? <p role="alert">{controller.error}</p> : null}
        <label
          className="syn-contextual-assistant-popover__prompt-label"
          htmlFor="assistant-quick-prompt"
        >
          Câu hỏi
        </label>
        <div className="syn-contextual-assistant-popover__composer-row">
          <textarea
            id="assistant-quick-prompt"
            placeholder={
              invocation.source === 'theory'
                ? 'Hỏi về nội dung lý thuyết…'
                : 'Hỏi về bài tập đang làm…'
            }
            value={controller.prompt}
            onChange={(event) => controller.setPrompt(event.currentTarget.value)}
          />
          <button
            type="button"
            aria-label="Gửi"
            disabled={pending || controller.prompt.trim() === ''}
            onClick={() => void controller.submit('explain')}
          >
            <SendHorizontal aria-hidden="true" size={18} />
          </button>
        </div>
      </footer>
    </section>
  );
}
