import type { ActivityStatusPayload } from '@synaploom/protocol';
import type { ReactNode } from 'react';
import { activityStatusLabel } from '#src/features/learning-workspace/ActivityTray';
import {
  findActivityStatus,
  type ResolvedWorkspaceActivity,
} from '#src/features/learning-workspace/workspace-model';

export interface PracticeActivityNavigatorProps {
  readonly activities: readonly ResolvedWorkspaceActivity[];
  readonly statuses: readonly ActivityStatusPayload[];
  readonly focusedActivityId: string | null;
  readonly onSelectActivity: (activityId: string) => Promise<void>;
  readonly onSelectionComplete?: () => void;
}

export function PracticeActivityNavigator({
  activities,
  statuses,
  focusedActivityId,
  onSelectActivity,
  onSelectionComplete,
}: PracticeActivityNavigatorProps): ReactNode {
  return (
    <nav className="syn-practice-activity-navigator" aria-label="Danh sách hoạt động">
      <header className="syn-practice-activity-navigator__header">
        <strong>Thực hành · {activities.length} hoạt động</strong>
      </header>
      <ol className="syn-practice-activity-navigator__list">
        {activities.map((item, index) => {
          const status = findActivityStatus(statuses, item.activity.id);
          const label = activityStatusLabel(status?.status ?? 'AVAILABLE');
          const active = item.activity.id === focusedActivityId;
          return (
            <li key={item.activity.id}>
              <button
                type="button"
                className="syn-practice-activity-navigator__item"
                aria-label={`${index + 1}. ${item.activity.title}. ${label}`}
                aria-current={active ? 'true' : undefined}
                onClick={() => {
                  void onSelectActivity(item.activity.id)
                    .then(() => onSelectionComplete?.())
                    .catch(() => undefined);
                }}
              >
                <span className="syn-practice-activity-navigator__ordinal" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="syn-practice-activity-navigator__copy">
                  <strong>{item.activity.title}</strong>
                  <span>{label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="syn-practice-activity-navigator__guidance">
        Chỉ một hoạt động mở tại một thời điểm.
      </p>
    </nav>
  );
}
