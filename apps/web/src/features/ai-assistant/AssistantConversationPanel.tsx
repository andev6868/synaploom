import { Bot, ChevronRight, Mic, Plus, SendHorizontal, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { assistantActionsForInvocation } from '#src/features/ai-assistant/assistant-actions';
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
  const isStarterState = controller.messages.length === 0;
  const actions = assistantActionsForInvocation(controller.state.invocation);
  return (
    <>
      {includeHeader ? (
        <header className="syn-contextual-assistant-panel__header">
          <span className="syn-contextual-assistant-panel__avatar" aria-hidden="true">
            <Bot size={30} strokeWidth={2.25} />
          </span>
          <div className="syn-contextual-assistant-panel__identity">
            <strong>Trợ lý AI</strong>
            <AssistantContextBadge invocation={controller.state.invocation} />
          </div>
          <button
            type="button"
            className="syn-contextual-assistant__close"
            aria-label="Đóng Trợ lý AI"
            onClick={() => controller.close()}
          >
            <X aria-hidden="true" size={8} />
          </button>
        </header>
      ) : (
        <div className="syn-contextual-assistant-panel__mobile-context">
          <AssistantContextBadge invocation={controller.state.invocation} />
        </div>
      )}
      <div className="syn-contextual-assistant-panel__messages" aria-label="Cuộc hội thoại">
        {isStarterState ? (
          <>
            <p className="syn-contextual-assistant-panel__assistant-label">Trợ lý AI</p>
            <div className="syn-contextual-assistant-panel__starter" aria-label="Lời chào Trợ lý AI">
              <div className="syn-contextual-assistant-panel__starter-message">
                <span className="syn-contextual-assistant-panel__message-avatar" aria-hidden="true">
                  <Bot size={22} strokeWidth={2.25} />
                </span>
                <article data-role="assistant" data-variant="greeting">
                  <p>Mình có thể giúp gì cho bạn? 👋</p>
                  <time>10:24</time>
                </article>
              </div>
              <article data-role="assistant" data-variant="guidance">
                <p>Hãy đặt câu hỏi để bắt đầu cuộc hội thoại theo ngữ cảnh hiện tại.</p>
                <time>10:24</time>
              </article>
            </div>
            <section
              className="syn-contextual-assistant-panel__suggestions"
              aria-labelledby="assistant-suggestions-heading"
            >
              <h2 id="assistant-suggestions-heading">Gợi ý cho bạn</h2>
              <div
                className="syn-contextual-assistant-panel__actions"
                data-testid="assistant-expanded-actions"
              >
                {actions.map(({ label, description, kind, prompt, icon: Icon, tone }) => (
                  <button
                    key={label}
                    type="button"
                    data-tone={tone}
                    aria-label={label}
                    disabled={pending}
                    onClick={() => void controller.submit(kind, prompt)}
                  >
                    <span className="syn-contextual-assistant-panel__action-icon" aria-hidden="true">
                      <Icon size={24} />
                    </span>
                    <span className="syn-contextual-assistant-panel__action-copy">
                      <strong>{label}</strong>
                      <small>{description}</small>
                    </span>
                    <ChevronRight aria-hidden="true" size={20} />
                  </button>
                ))}
              </div>
            </section>
          </>
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
          <span className="syn-contextual-assistant-panel__composer-adornment" aria-hidden="true">
            <Plus size={22} />
          </span>
          <textarea
            id="assistant-conversation-prompt"
            placeholder="Tiếp tục cuộc hội thoại…"
            value={controller.prompt}
            onChange={(event) => controller.setPrompt(event.currentTarget.value)}
          />
          <span className="syn-contextual-assistant-panel__composer-adornment" aria-hidden="true">
            <Mic size={22} />
          </span>
          <button
            type="button"
            aria-label="Gửi"
            disabled={pending || controller.prompt.trim() === ''}
            onClick={() => void controller.submit('explain')}
          >
            <SendHorizontal aria-hidden="true" size={22} />
          </button>
        </div>
        <p className="syn-contextual-assistant-panel__disclaimer">
          AI có thể mắc lỗi. Hãy kiểm tra thông tin quan trọng.
        </p>
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
