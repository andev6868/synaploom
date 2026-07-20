import type { ActivityStatusPayload, ActivityWorkspaceStatus } from '@synaploom/protocol';
import { Check, ChevronRight, Circle, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { activityStatusLabel } from '#src/features/learning-workspace/ActivityTray';
import {
  findActivityStatus,
  type ResolvedWorkspaceActivity,
} from '#src/features/learning-workspace/workspace-model';

export function activityNavigatorStatusLabel(
  status: ActivityWorkspaceStatus,
  active: boolean,
): string {
  if (active) return 'Đang làm';
  return activityStatusLabel(status);
}

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
        <ChevronRight data-navigator-header-chevron aria-hidden="true" size={16} />
      </header>
      <ol className="syn-practice-activity-navigator__list">
        {activities.map((item, index) => {
          const status = findActivityStatus(statuses, item.activity.id);
          const active = item.activity.id === focusedActivityId;
          const workspaceStatus = status?.status ?? 'AVAILABLE';
          const displayStatus = active ? 'IN_PROGRESS' : workspaceStatus;
          const label = activityNavigatorStatusLabel(workspaceStatus, active);
          return (
            <li key={item.activity.id}>
              <button
                type="button"
                className="syn-practice-activity-navigator__item"
                data-navigator-item
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
                  <span data-navigator-status data-status={displayStatus}>
                    <span
                      className="syn-practice-activity-navigator__status-icon"
                      aria-hidden="true"
                    >
                      {!active && status?.status === 'PASSED' ? (
                        <Check size={12} />
                      ) : (
                        <Circle size={8} fill={active ? 'currentColor' : 'none'} />
                      )}
                    </span>
                    {label}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="syn-practice-activity-navigator__guidance">
        <Info data-navigator-guidance-icon aria-hidden="true" size={14} />
        <span>Chỉ một hoạt động mở tại một thời điểm.</span>
      </p>
    </nav>
  );
}
