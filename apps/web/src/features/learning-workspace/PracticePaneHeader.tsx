import type { ReactNode } from 'react';
import type { LearningWorkspaceController } from '#src/features/learning-workspace/useLearningWorkspaceController';
import type { ResolvedWorkspaceActivity } from '#src/features/learning-workspace/workspace-model';

export function PracticePaneHeader({
  focusedActivity,
  ordinal,
  total,
  controller,
}: {
  readonly focusedActivity: ResolvedWorkspaceActivity;
  readonly ordinal: number;
  readonly total: number;
  readonly controller: LearningWorkspaceController;
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
      </div>
      <div>
        {focusedActivity.activity.presentation.allowInline ? (
          <button
            type="button"
            onClick={() => {
              void controller.returnActivityInline().catch(() => undefined);
            }}
          >
            Làm tại đây
          </button>
        ) : null}
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
