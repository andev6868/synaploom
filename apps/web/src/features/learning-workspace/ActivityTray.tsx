import type { ActivityStatusPayload, ActivityWorkspaceStatus } from '@synaploom/protocol';
import type { ReactNode } from 'react';
import type { LearningWorkspaceController } from '#src/features/learning-workspace/useLearningWorkspaceController';
import {
  findActivityStatus,
  type ResolvedWorkspaceActivity,
} from '#src/features/learning-workspace/workspace-model';

export function activityStatusLabel(status: ActivityWorkspaceStatus): string {
  switch (status) {
    case 'AVAILABLE':
      return 'Chưa bắt đầu';
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
}: {
  readonly activities: readonly ResolvedWorkspaceActivity[];
  readonly statuses: readonly ActivityStatusPayload[];
  readonly controller: Pick<LearningWorkspaceController, 'focusActivity'>;
}): ReactNode {
  return (
    <section className="syn-activity-tray" aria-label="Hoạt động trong bài">
      <h3>Hoạt động trong bài</h3>
      <ul>
        {activities.map((item) => {
          const status = findActivityStatus(statuses, item.activity.id);
          const label = activityStatusLabel(status?.status ?? 'AVAILABLE');
          return (
            <li key={item.activity.id}>
              <button
                type="button"
                onClick={() => {
                  void controller.focusActivity(item.activity.id).catch(() => undefined);
                }}
              >
                <strong>{item.activity.title}</strong>
                <span>{item.required ? 'Bắt buộc' : 'Tùy chọn'}</span>
                <span>{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
