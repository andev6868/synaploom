import type { ActivityStatusPayload } from '@synaploom/protocol';
import { Button } from '@synaploom/ui';
import { Check, Circle, List, Maximize2, Minimize2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { LearningWorkspaceController } from '#src/features/learning-workspace/useLearningWorkspaceController';
import type { ResolvedWorkspaceActivity } from '#src/features/learning-workspace/workspace-model';

export function PracticePaneHeader({
  focusedActivity,
  ordinal,
  total,
  controller,
  status,
  navigatorOpen,
  navigatorTargetId,
  navigatorUsesDrawer,
  onToggleNavigator,
}: {
  readonly focusedActivity: ResolvedWorkspaceActivity;
  readonly ordinal: number;
  readonly total: number;
  readonly controller: LearningWorkspaceController;
  readonly status: ActivityStatusPayload | null;
  readonly navigatorOpen: boolean;
  readonly navigatorTargetId: string;
  readonly navigatorUsesDrawer: boolean;
  readonly onToggleNavigator: () => void;
}): ReactNode {
  const activeLabel = 'Đang làm';
  const hasSavedDraft = status?.status === 'DRAFT';
  const saveLabel =
    controller.saveStatus === 'saving'
      ? 'Đang lưu…'
      : controller.saveStatus === 'error' || controller.saveStatus === 'conflict'
        ? 'Lưu thất bại'
        : hasSavedDraft
          ? 'Đã lưu bản nháp'
          : null;
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
        <div className="syn-practice-workspace-card__statuses">
          <p
            className="syn-practice-workspace-card__active-status"
            data-testid="practice-active-status"
          >
            <Circle aria-hidden="true" fill="currentColor" size={8} />
            <span>{activeLabel}</span>
          </p>
          {saveLabel ? (
            <p
              className="syn-practice-pane__save-status"
              data-testid="practice-save-status"
              aria-live="polite"
            >
              {hasSavedDraft &&
              controller.saveStatus !== 'saving' &&
              controller.saveStatus !== 'error' &&
              controller.saveStatus !== 'conflict' ? (
                <Check aria-hidden="true" size={13} />
              ) : (
                <Circle aria-hidden="true" size={8} />
              )}
              <span>{saveLabel}</span>
            </p>
          ) : null}
        </div>
      </div>
      <div className="syn-practice-workspace-card__controls" data-testid="practice-header-controls">
        <Button
          size="sm"
          variant="secondary"
          aria-expanded={navigatorUsesDrawer ? navigatorOpen : undefined}
          aria-controls={navigatorTargetId}
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
