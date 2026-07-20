import type { ActivityStatusPayload, ActivityWorkspaceStatus } from '@synaploom/protocol';
import type { ReactNode } from 'react';
import { PracticeActivityNavigator } from '#src/features/learning-workspace/PracticeActivityNavigator';
import type { LearningWorkspaceController } from '#src/features/learning-workspace/useLearningWorkspaceController';
import type { ResolvedWorkspaceActivity } from '#src/features/learning-workspace/workspace-model';

export function activityStatusLabel(status: ActivityWorkspaceStatus): string {
  switch (status) {
    case 'AVAILABLE':
      return 'Chưa mở';
    case 'DRAFT':
      return 'Bản nháp';
    case 'IN_PROGRESS':
      return 'Đang chấm';
    case 'PASSED':
      return 'Đã đạt';
    case 'FAILED':
      return 'Chưa đạt';
  }
}

export function ActivityTray({
  activities,
  statuses,
  controller,
  focusedActivityId,
}: {
  readonly activities: readonly ResolvedWorkspaceActivity[];
  readonly statuses: readonly ActivityStatusPayload[];
  readonly controller: Pick<LearningWorkspaceController, 'focusActivity'>;
  readonly focusedActivityId: string | null;
}): ReactNode {
  return (
    <PracticeActivityNavigator
      activities={activities}
      statuses={statuses}
      focusedActivityId={focusedActivityId}
      onSelectActivity={(activityId) => controller.focusActivity(activityId)}
    />
  );
}
