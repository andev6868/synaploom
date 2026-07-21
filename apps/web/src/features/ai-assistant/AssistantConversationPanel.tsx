import { Dialog } from '@synaploom/ui';
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
          <button type="button" aria-label="Đóng Trợ lý AI" onClick={() => controller.close()}>
            ×
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
        <label htmlFor="assistant-conversation-prompt">Tiếp tục cuộc hội thoại</label>
        <textarea
          id="assistant-conversation-prompt"
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
      <Dialog
        title="Trợ lý AI"
        description={
          controller.state.invocation.source === 'theory'
            ? 'Hội thoại theo ngữ cảnh lý thuyết đang xem.'
            : 'Hội thoại theo ngữ cảnh bài tập đang làm.'
        }
        open
        onOpenChange={(open) => {
          if (!open) controller.close();
        }}
        contentClassName="syn-contextual-assistant-panel--mobile"
      >
        <div data-testid="assistant-expanded-panel" className="syn-contextual-assistant-panel__mobile-body">
          <ConversationContent controller={controller} includeHeader={false} />
        </div>
      </Dialog>
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
