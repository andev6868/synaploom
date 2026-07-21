import type { ActivityOwner, ActivityStatusPayload } from '@synaploom/protocol';
import { Button } from '@synaploom/ui';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityHost } from '#src/features/activity-engine/ActivityHost';
import type { ActivityHostProps } from '#src/features/activity-engine/types';
import type { AssistantInvocation } from '#src/features/ai-assistant/contextual-assistant-model';
import { PracticeActivityNavigator } from '#src/features/learning-workspace/PracticeActivityNavigator';
import { PracticePaneHeader } from '#src/features/learning-workspace/PracticePaneHeader';
import type {
  LearningWorkspaceController,
  WorkspaceSaveStatus,
} from '#src/features/learning-workspace/useLearningWorkspaceController';
import {
  useWorkspaceViewport,
  type WorkspaceViewport,
} from '#src/features/learning-workspace/useWorkspaceViewport';
import {
  findActivityStatus,
  findNextActivityId,
  type ResolvedWorkspaceActivity,
} from '#src/features/learning-workspace/workspace-model';

export function workspaceSaveFailureMessage(saveStatus: WorkspaceSaveStatus): string {
  return saveStatus === 'conflict'
    ? 'Không thể đồng bộ thay đổi vì không gian học vừa được cập nhật. Vui lòng thử lại.'
    : 'Không thể lưu thay đổi khu vực học. Vui lòng thử lại.';
}

export function formatDraftSavedTime(value: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(value);
}

export interface PracticePaneProps {
  readonly owner: ActivityOwner;
  readonly activities: readonly ResolvedWorkspaceActivity[];
  readonly statuses: readonly ActivityStatusPayload[];
  readonly controller: LearningWorkspaceController;
  readonly onProgressChanged: () => Promise<void> | void;
  readonly onAskPractice: (invocation: AssistantInvocation) => void;
  readonly renderHost?: (props: ActivityHostProps) => ReactNode;
}

export function PracticePane({
  owner,
  activities,
  statuses,
  controller,
  onProgressChanged,
  onAskPractice,
  renderHost = (props) => <ActivityHost {...props} />,
}: PracticePaneProps): ReactNode {
  const viewport = useWorkspaceViewport();
  const navigatorUsesDrawer = viewport !== 'wide-three';
  const navigatorTargetId = navigatorUsesDrawer
    ? 'practice-activity-navigator-drawer'
    : 'workspace-activity-navigator';
  const [navigatorOpenViewport, setNavigatorOpenViewport] = useState<WorkspaceViewport | null>(
    null,
  );
  const navigatorOpen = navigatorUsesDrawer && navigatorOpenViewport === viewport;
  const [activityActions, setActivityActions] = useState<ReactNode>(null);
  const actionOutlet = useMemo(() => ({ setActions: setActivityActions }), []);
  const focused = controller.focusedActivity;
  const focusedId = focused?.activity.id ?? null;
  const status = focusedId ? findActivityStatus(statuses, focusedId) : null;
  const previousStatusRef = useRef(status?.status);
  const previousFocusedIdRef = useRef(focusedId);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (previousFocusedIdRef.current !== focusedId) {
      previousFocusedIdRef.current = focusedId;
      previousStatusRef.current = status?.status;
      setLastSavedAt(null);
      return;
    }
    if (status?.status === 'DRAFT' && previousStatusRef.current !== 'DRAFT') {
      setLastSavedAt(new Date());
    }
    previousStatusRef.current = status?.status;
  }, [focusedId, status?.status]);

  const toggleNavigator = (): void => {
    if (navigatorUsesDrawer) {
      setNavigatorOpenViewport((openViewport) => (openViewport === viewport ? null : viewport));
      return;
    }
    document.getElementById('workspace-activity-navigator')?.focus();
  };

  if (!focused) return null;
  const ordinal = activities.findIndex((item) => item.activity.id === focused.activity.id) + 1;
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
    <section className="syn-practice-pane" aria-label="Khu vực thực hành" data-practice-surface>
      <div className="syn-practice-workspace-card" data-testid="practice-workspace-card">
        <PracticePaneHeader
          focusedActivity={focused}
          ordinal={ordinal}
          total={activities.length}
          controller={controller}
          status={status}
          navigatorOpen={navigatorOpen}
          navigatorTargetId={navigatorTargetId}
          navigatorUsesDrawer={navigatorUsesDrawer}
          onToggleNavigator={toggleNavigator}
          onAskAI={(anchor) =>
            onAskPractice({
              source: 'practice',
              activityId: focused.activity.id,
              activityTitle: focused.activity.title,
              anchor,
            })
          }
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
          <div
            className="syn-practice-workspace-card__footer-status"
            data-testid="practice-footer-status"
          >
            {controller.saveStatus === 'error' || controller.saveStatus === 'conflict' ? (
              <div className="syn-practice-pane__feedback" role="alert">
                <p>{workspaceSaveFailureMessage(controller.saveStatus)}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void controller.retryLastSave().catch(() => undefined)}
                >
                  Thử lưu lại
                </Button>
              </div>
            ) : (
              <span>
                {lastSavedAt
                  ? `Đã lưu bản nháp lúc ${formatDraftSavedTime(lastSavedAt)}`
                  : status?.status === 'DRAFT'
                    ? 'Đã lưu bản nháp'
                    : 'Sẵn sàng'}
              </span>
            )}
          </div>
          <div
            className="syn-practice-workspace-card__footer-actions"
            data-practice-action-outlet
            data-testid="practice-footer-actions"
          >
            {activityActions}
            {status?.status === 'PASSED' && nextId ? (
              <Button
                size="sm"
                onClick={() => void controller.selectNextActivity().catch(() => undefined)}
              >
                Hoạt động tiếp theo
              </Button>
            ) : null}
          </div>
          {status?.status === 'PASSED' && !nextId ? (
            <p
              className="syn-practice-workspace-card__completion"
              data-testid="practice-completion-status"
              role="status"
            >
              Tất cả hoạt động trong bài đã hoàn thành
            </p>
          ) : null}
        </footer>
      </div>
      {navigatorUsesDrawer && navigatorOpen ? (
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
            onSelectionComplete={() => setNavigatorOpenViewport(null)}
          />
        </div>
      ) : null}
    </section>
  );
}
