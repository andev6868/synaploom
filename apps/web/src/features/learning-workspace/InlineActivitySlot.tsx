import type { ActivityStatusPayload, PracticePaneMode } from '@synaploom/protocol';
import type { ReactNode } from 'react';
import { ActivitySummaryCard } from '#src/features/learning-workspace/ActivitySummaryCard';
import type { ResolvedWorkspaceActivity } from '#src/features/learning-workspace/workspace-model';

export interface InlineActivitySlotProps {
  readonly item: ResolvedWorkspaceActivity;
  readonly focused: boolean;
  readonly paneMode: PracticePaneMode;
  readonly status: ActivityStatusPayload | null;
  readonly onOpenPractice: (activityId: string) => Promise<void>;
  readonly onRegisterInlineHeading?: (activityId: string, element: HTMLElement | null) => void;
}

export function InlineActivitySlot({
  item,
  focused,
  paneMode,
  status,
  onOpenPractice,
  onRegisterInlineHeading = () => undefined,
}: InlineActivitySlotProps): ReactNode {
  return (
    <ActivitySummaryCard
      item={item}
      focused={focused}
      paneMode={paneMode}
      status={status}
      onOpenPractice={onOpenPractice}
      onRegisterHeading={onRegisterInlineHeading}
    />
  );
}
