import type { ReactNode } from 'react';
import { AssistantContextBadge } from '#src/features/ai-assistant/AssistantContextBadge';
import type { ContextualAssistantController } from '#src/features/ai-assistant/contextual-assistant-model';

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
  return (
    <section
      className="syn-contextual-assistant-panel"
      data-testid="assistant-expanded-panel"
      data-assistant-mobile={mobile ? 'true' : 'false'}
      data-assistant-compact={compact ? 'true' : 'false'}
      role="dialog"
      aria-modal={mobile || undefined}
      aria-label="Cuộc hội thoại với Trợ lý AI"
    >
      <header className="syn-contextual-assistant-panel__header">
        <div>
          <strong>Trợ lý AI</strong>
          <AssistantContextBadge invocation={controller.state.invocation} />
        </div>
        <button type="button" aria-label="Đóng cuộc hội thoại" onClick={() => controller.close()}>
          ×
        </button>
      </header>
    </section>
  );
}
