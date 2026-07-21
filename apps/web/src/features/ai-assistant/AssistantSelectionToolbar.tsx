import type { CSSProperties, ReactNode } from 'react';
import type { TheoryAssistantSelection } from '#src/features/ai-assistant/useTheoryAssistantSelection';

export function AssistantSelectionToolbar({
  selection,
  onAsk,
}: {
  readonly selection: TheoryAssistantSelection;
  readonly onAsk: (anchor: DOMRect) => void;
}): ReactNode {
  const left = Math.max(12, Math.min(selection.rect.left, window.innerWidth - 220));
  const top = Math.max(12, selection.rect.top - 44);
  const style = { left, top } satisfies CSSProperties;

  return (
    <div
      data-assistant-selection-toolbar
      data-testid="assistant-selection-toolbar"
      className="syn-assistant-selection-toolbar"
      style={style}
      onPointerDown={(event) => event.preventDefault()}
    >
      <button
        type="button"
        aria-label="Hỏi AI về đoạn lý thuyết đã chọn"
        onClick={() => onAsk(selection.rect)}
      >
        Hỏi AI về đoạn này
      </button>
    </div>
  );
}
