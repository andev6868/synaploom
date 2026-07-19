import type { ActivityStatusPayload } from '@synaploom/protocol';
import type { ReactNode } from 'react';
import { ActivityTray } from '#src/features/learning-workspace/ActivityTray';
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
    <aside className="syn-workspace-pane-rail" data-workspace-practice-rail>
      <details>
        <summary>Chọn hoạt động thực hành, {activities.length} hoạt động</summary>
        <ActivityTray
          activities={activities}
          statuses={statuses}
          controller={controller}
          focusedActivityId={null}
        />
      </details>
    </aside>
  );
}
