import type { ActivityStatusPayload } from '@synaploom/protocol';
import type { ReactNode } from 'react';
import { activityStatusLabel } from '#src/features/learning-workspace/ActivityTray';
import type { LearningWorkspaceController } from '#src/features/learning-workspace/useLearningWorkspaceController';
import type { ResolvedWorkspaceActivity } from '#src/features/learning-workspace/workspace-model';

export function PracticePaneHeader({
  focusedActivity,
  ordinal,
  total,
  controller,
  status,
}: {
  readonly focusedActivity: ResolvedWorkspaceActivity;
  readonly ordinal: number;
  readonly total: number;
  readonly controller: LearningWorkspaceController;
  readonly status: ActivityStatusPayload | null;
}): ReactNode {
  return (
    <header className="syn-practice-pane__header">
      <div>
        <span>
          {ordinal}/{total}
        </span>
        <h2
          ref={(element) =>
            controller.registerPracticeHeading(focusedActivity.activity.id, element)
          }
          data-workspace-activity-heading
          tabIndex={-1}
        >
          {focusedActivity.activity.title}
        </h2>
        <p className="syn-practice-pane__save-status" aria-live="polite">
          {controller.saveStatus === 'saving'
            ? 'Đang lưu…'
            : controller.saveStatus === 'saved'
              ? 'Đã lưu bản nháp'
              : controller.saveStatus === 'error'
                ? 'Lưu thất bại'
                : activityStatusLabel(status?.status ?? 'AVAILABLE')}
        </p>
      </div>
      <div>
        {focusedActivity.activity.presentation.supportsFullscreen ? (
          <button
            type="button"
            onClick={() => {
              void controller.expandPracticePane().catch(() => undefined);
            }}
          >
            Mở rộng
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            void controller.collapsePracticePane().catch(() => undefined);
          }}
        >
          Thu gọn
        </button>
      </div>
    </header>
  );
}
