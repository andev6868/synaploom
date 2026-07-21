import type { ReactNode } from 'react';
import type { AssistantInvocation } from '#src/features/ai-assistant/contextual-assistant-model';
import { assistantContextLabel } from '#src/features/ai-assistant/useContextualAssistant';

export function AssistantContextBadge({
  invocation,
}: {
  readonly invocation: AssistantInvocation;
}): ReactNode {
  return (
    <span className="syn-contextual-assistant-context" data-assistant-context-source={invocation.source}>
      {assistantContextLabel(invocation)}
    </span>
  );
}
