import type { ReactNode } from 'react';
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
