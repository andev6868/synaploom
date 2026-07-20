import type { ActivityStatusPayload } from '@synaploom/protocol';
import { Button } from '@synaploom/ui';
import { List, Minimize2, Maximize2 } from 'lucide-react';
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
  navigatorOpen,
  onToggleNavigator,
}: {
  readonly focusedActivity: ResolvedWorkspaceActivity;
  readonly ordinal: number;
  readonly total: number;
  readonly controller: LearningWorkspaceController;
  readonly status: ActivityStatusPayload | null;
  readonly navigatorOpen: boolean;
  readonly onToggleNavigator: () => void;
}): ReactNode {
  const saveLabel =
    controller.saveStatus === 'saving'
      ? 'Đang lưu…'
      : controller.saveStatus === 'saved'
        ? 'Đã lưu bản nháp'
        : controller.saveStatus === 'error'
          ? 'Lưu thất bại'
          : activityStatusLabel(status?.status ?? 'AVAILABLE');
  return (
    <header className="syn-practice-workspace-card__header">
      <div className="syn-practice-workspace-card__heading">
        <span className="syn-practice-workspace-card__ordinal">
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
          <span aria-hidden="true">{controller.saveStatus === 'saved' ? '✓' : '●'}</span>
          {saveLabel}
        </p>
      </div>
      <div className="syn-practice-workspace-card__controls">
        <Button
          size="sm"
          variant="secondary"
          aria-expanded={navigatorOpen}
          aria-controls="practice-activity-navigator-drawer"
          leadingIcon={<List size={16} />}
          onClick={onToggleNavigator}
        >
          Danh sách hoạt động
        </Button>
        {focusedActivity.activity.presentation.supportsFullscreen ? (
          <Button
            size="sm"
            variant="ghost"
            leadingIcon={<Maximize2 size={16} />}
            onClick={() => void controller.expandPracticePane().catch(() => undefined)}
          >
            Mở rộng
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          leadingIcon={<Minimize2 size={16} />}
          onClick={() => void controller.collapsePracticePane().catch(() => undefined)}
        >
          Thu gọn
        </Button>
      </div>
    </header>
  );
}
