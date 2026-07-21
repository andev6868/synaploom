import { Button } from '@synaploom/ui';
import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

export interface AssistantTriggerProps {
  readonly source: 'theory' | 'practice';
  readonly onInvoke: (anchor: HTMLButtonElement) => void;
  readonly className?: string;
}

export function AssistantTrigger({
  source,
  onInvoke,
  className,
}: AssistantTriggerProps): ReactNode {
  return (
    <Button
      className={className}
      size="sm"
      variant="secondary"
      leadingIcon={<Sparkles size={15} />}
      aria-label={source === 'theory' ? 'Hỏi AI về lý thuyết' : 'Hỏi AI về bài tập đang làm'}
      onClick={(event) => onInvoke(event.currentTarget)}
    >
      Hỏi AI
    </Button>
  );
}
