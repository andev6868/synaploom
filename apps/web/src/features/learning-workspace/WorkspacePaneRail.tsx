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
      <aside className="syn-workspace-pane-rail" aria-label="Khu vực thực hành đang thu gọn">
        <strong>Thực hành · {activities.length} hoạt động</strong>
        <p>{focusedActivity.activity.title} đang tạm ẩn.</p>
        <button
          type="button"
          onClick={() => {
            void controller.restoreSplitPane().catch(() => undefined);
          }}
        >
          Mở lại {focusedActivity.activity.title}
        </button>
      </aside>
    );
  }
  return (
    <aside className="syn-workspace-pane-rail">
      <details>
        <summary>Chọn hoạt động thực hành, {activities.length} hoạt động</summary>
        <ActivityTray activities={activities} statuses={statuses} controller={controller} />
      </details>
    </aside>
  );
}
