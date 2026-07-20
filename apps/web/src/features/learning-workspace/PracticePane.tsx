import type { ActivityOwner, ActivityStatusPayload } from '@synaploom/protocol';
import { Button } from '@synaploom/ui';
import { useMemo, useState, type ReactNode } from 'react';
import { ActivityHost } from '#src/features/activity-engine/ActivityHost';
import type { ActivityHostProps } from '#src/features/activity-engine/types';
import { PracticeActivityNavigator } from '#src/features/learning-workspace/PracticeActivityNavigator';
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
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [activityActions, setActivityActions] = useState<ReactNode>(null);
  const actionOutlet = useMemo(() => ({ setActions: setActivityActions }), []);
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
    surface: 'practice-contained',
    actionOutlet,
    onPersistenceHandleChange: controller.registerPersistenceHandle,
  };
  return (
    <section className="syn-practice-pane" aria-label="Khu vực thực hành">
      <div className="syn-practice-workspace-card" data-testid="practice-workspace-card">
        <PracticePaneHeader
          focusedActivity={focused}
          ordinal={ordinal}
          total={activities.length}
          controller={controller}
          status={status}
          navigatorOpen={navigatorOpen}
          onToggleNavigator={() => setNavigatorOpen((open) => !open)}
        />
        <div
          className="syn-practice-workspace-card__content"
          data-testid="practice-workspace-content"
        >
          <div className="syn-practice-pane__body" data-active-activity-editor>
            {renderHost(hostProps)}
          </div>
        </div>
        <footer
          className="syn-practice-workspace-card__footer"
          data-testid="practice-workspace-footer"
        >
          <div className="syn-practice-workspace-card__footer-status">
            {controller.saveStatus === 'error' || controller.saveStatus === 'conflict' ? (
              <div className="syn-practice-pane__feedback" role="alert">
                <p>{controller.error?.message ?? 'Không thể lưu trạng thái khu vực học.'}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void controller.retryLastSave().catch(() => undefined)}
                >
                  Thử lưu lại
                </Button>
              </div>
            ) : (
              <span>{controller.saveStatus === 'saved' ? 'Đã lưu bản nháp' : 'Sẵn sàng'}</span>
            )}
          </div>
          <div className="syn-practice-workspace-card__footer-actions" data-practice-action-outlet>
            {activityActions}
            {status?.status === 'PASSED' ? (
              nextId ? (
                <Button
                  size="sm"
                  onClick={() => void controller.selectNextActivity().catch(() => undefined)}
                >
                  Hoạt động tiếp theo
                </Button>
              ) : (
                <p>Tất cả hoạt động trong bài đã hoàn thành</p>
              )
            ) : null}
          </div>
        </footer>
      </div>
      {navigatorOpen ? (
        <div
          className="syn-practice-navigator-drawer"
          id="practice-activity-navigator-drawer"
          role="dialog"
          aria-label="Danh sách hoạt động"
        >
          <PracticeActivityNavigator
            activities={activities}
            statuses={statuses}
            focusedActivityId={focused.activity.id}
            onSelectActivity={(activityId) => controller.focusActivity(activityId)}
            onSelectionComplete={() => setNavigatorOpen(false)}
          />
        </div>
      ) : null}
    </section>
  );
}
