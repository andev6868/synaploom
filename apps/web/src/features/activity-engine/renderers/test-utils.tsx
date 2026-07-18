import type { ActivityAnswer, ActivityPublicView } from '@synaploom/contracts';
import { useState, type ComponentType, type ReactNode } from 'react';
import type { ActivityRendererProps } from '#src/features/activity-engine/types';

export function RendererHarness({
  Renderer,
  activity,
  initialAnswer = null,
}: {
  readonly Renderer: ComponentType<ActivityRendererProps>;
  readonly activity: ActivityPublicView;
  readonly initialAnswer?: ActivityAnswer | null;
}): ReactNode {
  const [answer, setAnswer] = useState<ActivityAnswer | null>(initialAnswer);
  return (
    <Renderer
      activity={activity}
      answer={answer}
      disabled={false}
      onChange={setAnswer}
      onSaveDraft={() => Promise.resolve()}
      onSubmit={() => Promise.resolve()}
    />
  );
}
