import type { ActivityStatusPayload } from '@synaploom/protocol';
import { useId, useState, type ReactNode } from 'react';
import { PracticeActivityNavigator } from '#src/features/learning-workspace/PracticeActivityNavigator';
import type { LearningWorkspaceController } from '#src/features/learning-workspace/useLearningWorkspaceController';
import type { ResolvedWorkspaceActivity } from '#src/features/learning-workspace/workspace-model';

export function WorkspacePaneRail({
  activities,
  statuses,
  focusedActivity,
  controller,
}: {
  readonly activities: readonly ResolvedWorkspaceActivity[];
  readonly statuses: readonly ActivityStatusPayload[];
  readonly focusedActivity: ResolvedWorkspaceActivity | null;
  readonly controller: LearningWorkspaceController;
}): ReactNode {
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const navigatorId = useId();

  if (activities.length === 0) return null;
  if (focusedActivity) {
    return (
      <aside
        className="syn-workspace-pane-rail"
        data-workspace-practice-rail
        aria-label="Khu vực thực hành đang thu gọn"
      >
        <button
          type="button"
          aria-expanded="false"
          aria-controls="syn-practice-pane"
          aria-label={`Mở lại ${focusedActivity.activity.title}`}
          onClick={() => void controller.restoreSplitPane().catch(() => undefined)}
        >
          <span aria-hidden="true">↤</span>
          <strong>Thực hành</strong>
          <span>{activities.length}</span>
        </button>
      </aside>
    );
  }
  return (
    <aside
      className="syn-workspace-pane-rail syn-workspace-pane-rail--picker"
      data-workspace-practice-rail
      aria-label="Chọn khu vực thực hành"
    >
      <button
        type="button"
        aria-label="Chọn hoạt động thực hành"
        aria-expanded={navigatorOpen}
        aria-controls={navigatorId}
        onClick={() => setNavigatorOpen((open) => !open)}
      >
        <span aria-hidden="true">☰</span>
        <strong>Chọn</strong>
        <span>{activities.length}</span>
      </button>
      {navigatorOpen ? (
        <div id={navigatorId} className="syn-workspace-pane-rail__navigator">
          <PracticeActivityNavigator
            activities={activities}
            statuses={statuses}
            focusedActivityId={null}
            onSelectActivity={(activityId) => controller.focusActivity(activityId)}
            onSelectionComplete={() => setNavigatorOpen(false)}
          />
        </div>
      ) : null}
    </aside>
  );
}
