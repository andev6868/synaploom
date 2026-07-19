import type { ActivityOwner, ActivityStatusPayload } from '@synaploom/protocol';
import type { ReactNode } from 'react';
import { ActivityHost } from '#src/features/activity-engine/ActivityHost';
import type { ActivityHostProps } from '#src/features/activity-engine/types';
import { ActivityTray } from '#src/features/learning-workspace/ActivityTray';
import { PracticePaneHeader } from '#src/features/learning-workspace/PracticePaneHeader';
import type { LearningWorkspaceController } from '#src/features/learning-workspace/useLearningWorkspaceController';
import {
  findActivityStatus,
  findNextActivityId,
  type ResolvedWorkspaceActivity,
} from '#src/features/learning-workspace/workspace-model';

export interface PracticePaneProps {
  readonly owner: ActivityOwner;
  readonly activities: readonly ResolvedWorkspaceActivity[];
  readonly statuses: readonly ActivityStatusPayload[];
  readonly controller: LearningWorkspaceController;
  readonly onProgressChanged: () => Promise<void> | void;
  readonly renderHost?: (props: ActivityHostProps) => ReactNode;
}

export function PracticePane({
  owner,
  activities,
  statuses,
  controller,
  onProgressChanged,
  renderHost = (props) => <ActivityHost {...props} />,
}: PracticePaneProps): ReactNode {
  const focused = controller.focusedActivity;
  if (!focused) return null;
  const ordinal = activities.findIndex((item) => item.activity.id === focused.activity.id) + 1;
  const status = findActivityStatus(statuses, focused.activity.id);
  const nextId = findNextActivityId(activities, focused.activity.id);
  const hostProps: ActivityHostProps = {
    owner,
    activity: focused.activity,
    policy: focused.policy,
    onProgressChanged,
    onPersistenceHandleChange: controller.registerPersistenceHandle,
  };
  return (
    <section className="syn-practice-pane" aria-label="Khu vực thực hành">
      <PracticePaneHeader
        focusedActivity={focused}
        ordinal={ordinal}
        total={activities.length}
        controller={controller}
      />
      <details className="syn-practice-pane__tray">
        <summary>Hoạt động trong bài</summary>
        <ActivityTray activities={activities} statuses={statuses} controller={controller} />
      </details>
      <div className="syn-practice-pane__body">{renderHost(hostProps)}</div>
      {controller.saveStatus === 'error' || controller.saveStatus === 'conflict' ? (
        <div className="syn-practice-pane__feedback" role="alert">
          <p>{controller.error?.message ?? 'Không thể lưu trạng thái khu vực học.'}</p>
          <button
            type="button"
            onClick={() => {
              void controller.retryLastSave().catch(() => undefined);
            }}
          >
            Thử lưu lại
          </button>
        </div>
      ) : null}
      {status?.status === 'PASSED' ? (
        <div className="syn-practice-pane__actions">
          {nextId ? (
            <button
              type="button"
              onClick={() => {
                void controller.selectNextActivity().catch(() => undefined);
              }}
            >
              Hoạt động tiếp theo
            </button>
          ) : (
            <p>Tất cả hoạt động trong bài đã hoàn thành</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
