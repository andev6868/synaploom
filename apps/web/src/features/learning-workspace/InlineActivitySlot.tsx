import type { ActivityStatusPayload, ActivityOwner, PracticePaneMode } from '@synaploom/protocol';
import type { ReactNode } from 'react';
import type { ActivityHostProps } from '#src/features/activity-engine/types';
import { ActivitySummaryCard } from '#src/features/learning-workspace/ActivitySummaryCard';
import type { ResolvedWorkspaceActivity } from '#src/features/learning-workspace/workspace-model';

export interface InlineActivitySlotProps {
  readonly item: ResolvedWorkspaceActivity;
  readonly owner: ActivityOwner;
  readonly focused: boolean;
  readonly paneMode: PracticePaneMode;
  readonly status: ActivityStatusPayload | null;
  readonly onOpenPractice: (activityId: string) => Promise<void>;
  readonly onProgressChanged: () => Promise<void> | void;
  readonly onPersistenceHandleChange: NonNullable<ActivityHostProps['onPersistenceHandleChange']>;
  readonly onRegisterInlineHeading?: (activityId: string, element: HTMLElement | null) => void;
  readonly renderHost?: (props: ActivityHostProps) => ReactNode;
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
