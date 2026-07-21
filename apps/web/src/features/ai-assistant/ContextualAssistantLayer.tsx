import { useEffect, type ReactNode } from 'react';
import { AssistantConversationPanel } from '#src/features/ai-assistant/AssistantConversationPanel';
import { AssistantQuickPopover } from '#src/features/ai-assistant/AssistantQuickPopover';
import type { ContextualAssistantController } from '#src/features/ai-assistant/contextual-assistant-model';
import { useWorkspaceViewport } from '#src/features/learning-workspace/useWorkspaceViewport';

export function ContextualAssistantLayer({
  controller,
}: {
  readonly controller: ContextualAssistantController;
}): ReactNode {
  const viewport = useWorkspaceViewport();

  useEffect(() => {
    if (controller.state.kind === 'closed') return undefined;
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      controller.close();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [controller]);

  if (controller.state.kind === 'closed') return null;
  if (controller.state.kind === 'quick') {
    return <AssistantQuickPopover controller={controller} />;
  }
  return (
    <AssistantConversationPanel
      controller={controller}
      mobile={viewport === 'mobile'}
      compact={viewport === 'compact'}
    />
  );
}
