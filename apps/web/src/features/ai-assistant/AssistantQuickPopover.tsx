import type { AiRequestKind } from '@synaploom/ai-contracts';
import { X } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { AssistantContextBadge } from '#src/features/ai-assistant/AssistantContextBadge';
import type {
  AssistantInvocation,
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

const theoryActions = [
  ['Giải thích', 'explain', 'Giải thích nội dung này bằng ngôn ngữ dễ hiểu.'],
  ['Cho ví dụ', 'explain', 'Cho một ví dụ cụ thể về nội dung này.'],
  ['Tóm tắt', 'summarize', 'Tóm tắt các ý chính của nội dung này.'],
] as const satisfies readonly (readonly [string, AiRequestKind, string])[];

const practiceActions = [
  ['Gợi ý', 'hint', 'Cho một gợi ý tiếp theo nhưng không đưa đáp án hoàn chỉnh.'],
  ['Giải thích lỗi', 'explain-check-failure', 'Giải thích lỗi trong cách làm hiện tại.'],
  ['Kiểm tra cách làm', 'explain', 'Kiểm tra hướng làm hiện tại và nêu điểm cần xem lại.'],
] as const satisfies readonly (readonly [string, AiRequestKind, string])[];

export function AssistantQuickPopover({
  controller,
}: {
  readonly controller: ContextualAssistantController;
}): ReactNode {
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
  const actions = invocation.source === 'theory' ? theoryActions : practiceActions;
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
        <div>
          <strong>Trợ lý AI</strong>
          <AssistantContextBadge invocation={invocation} />
        </div>
        <button
          type="button"
          className="syn-contextual-assistant__close"
          aria-label="Đóng Trợ lý AI"
          onClick={() => controller.close()}
        >
          <X aria-hidden="true" size={16} />
        </button>
      </header>
      <div className="syn-contextual-assistant-popover__body">
        {invocation.selectedText ? (
          <blockquote>{invocation.selectedText.slice(0, 240)}</blockquote>
        ) : null}
        <div className="syn-contextual-assistant-popover__answer" aria-live="polite" role="status">
          {pending
            ? 'Đang tạo câu trả lời…'
            : (controller.response ?? 'Hãy đặt câu hỏi hoặc chọn một gợi ý bên dưới.')}
        </div>
        {controller.error ? <p role="alert">{controller.error}</p> : null}
        <div className="syn-contextual-assistant-popover__actions">
          {actions.map(([label, kind, prompt]) => (
            <button
              key={label}
              type="button"
              disabled={pending}
              onClick={() => void controller.submit(kind, prompt)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <footer className="syn-contextual-assistant-popover__footer">
        <label htmlFor="assistant-quick-prompt">Câu hỏi</label>
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
        <div className="syn-contextual-assistant-popover__footer-actions">
          <button
            type="button"
            disabled={pending || controller.prompt.trim() === ''}
            onClick={() => void controller.submit('explain')}
          >
            Gửi
          </button>
          <button
            type="button"
            className="syn-contextual-assistant-popover__expand"
            onClick={() => controller.expand()}
          >
            Mở cuộc hội thoại đầy đủ →
          </button>
        </div>
      </footer>
    </section>
  );
}
