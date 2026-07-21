import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { AssistantContextBadge } from '#src/features/ai-assistant/AssistantContextBadge';
import type { ContextualAssistantController } from '#src/features/ai-assistant/contextual-assistant-model';

function ConversationContent({
  controller,
  includeHeader,
}: {
  readonly controller: ContextualAssistantController;
  readonly includeHeader: boolean;
}): ReactNode {
  if (controller.state.kind !== 'expanded') return null;
  const pending = controller.status === 'submitting';
  return (
    <>
      {includeHeader ? (
        <header className="syn-contextual-assistant-panel__header">
          <div>
            <strong>Trợ lý AI</strong>
            <AssistantContextBadge invocation={controller.state.invocation} />
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
      ) : (
        <div className="syn-contextual-assistant-panel__mobile-context">
          <AssistantContextBadge invocation={controller.state.invocation} />
        </div>
      )}
      <div className="syn-contextual-assistant-panel__messages" aria-label="Cuộc hội thoại">
        {controller.messages.length === 0 ? (
          <p className="syn-contextual-assistant-panel__empty">
            Hãy đặt câu hỏi để bắt đầu cuộc hội thoại theo ngữ cảnh hiện tại.
          </p>
        ) : (
          controller.messages.map((message) => (
            <article key={message.id} data-role={message.role}>
              <span>{message.contextLabel}</span>
              <p>{message.content}</p>
            </article>
          ))
        )}
      </div>
      <footer className="syn-contextual-assistant-panel__composer">
        <div aria-live="polite" role="status">
          {pending
            ? 'Đang tạo câu trả lời…'
            : controller.status === 'disabled'
              ? controller.response
              : null}
        </div>
        {controller.error ? <p role="alert">{controller.error}</p> : null}
        <label htmlFor="assistant-conversation-prompt">Tiếp tục cuộc hội thoại</label>
        <div className="syn-contextual-assistant-panel__composer-row">
          <textarea
            id="assistant-conversation-prompt"
            placeholder="Tiếp tục cuộc hội thoại…"
            value={controller.prompt}
            onChange={(event) => controller.setPrompt(event.currentTarget.value)}
          />
          <button
            type="button"
            disabled={pending || controller.prompt.trim() === ''}
            onClick={() => void controller.submit('explain')}
          >
            {pending ? 'Đang gửi…' : 'Gửi'}
          </button>
        </div>
      </footer>
    </>
  );
}

export function AssistantConversationPanel({
  controller,
  mobile,
  compact,
}: {
  readonly controller: ContextualAssistantController;
  readonly mobile: boolean;
  readonly compact: boolean;
}): ReactNode {
  if (controller.state.kind !== 'expanded') return null;
  if (mobile) {
    return (
      <section
        className="syn-contextual-assistant-panel syn-contextual-assistant-panel--mobile"
        data-testid="assistant-expanded-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Trợ lý AI"
      >
        <ConversationContent controller={controller} includeHeader />
      </section>
    );
  }
  return (
    <aside
      className={[
        'syn-contextual-assistant-panel',
        compact ? 'syn-contextual-assistant-panel--compact' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid="assistant-expanded-panel"
      aria-label="Trợ lý AI"
    >
      <ConversationContent controller={controller} includeHeader />
    </aside>
  );
}
