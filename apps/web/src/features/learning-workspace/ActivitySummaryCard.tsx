import type { ActivityStatusPayload, PracticePaneMode } from '@synaploom/protocol';
import { Button } from '@synaploom/ui';
import { ArrowRight, Check, Circle, ClipboardCheck, Code2, ListOrdered } from 'lucide-react';
import type { ReactNode } from 'react';
import { activityStatusLabel } from '#src/features/learning-workspace/ActivityTray';
import type { ResolvedWorkspaceActivity } from '#src/features/learning-workspace/workspace-model';

export interface ActivitySummaryCardProps {
  readonly item: ResolvedWorkspaceActivity;
  readonly focused: boolean;
  readonly paneMode: PracticePaneMode;
  readonly status: ActivityStatusPayload | null;
  readonly onOpenPractice: (activityId: string) => Promise<void>;
  readonly onRegisterHeading?: (activityId: string, element: HTMLElement | null) => void;
}

function summaryIcon(kind: ResolvedWorkspaceActivity['activity']['kind']): ReactNode {
  if (kind === 'coding') return <Code2 size={18} aria-hidden />;
  if (kind === 'ordering') return <ListOrdered size={18} aria-hidden />;
  return <ClipboardCheck size={18} aria-hidden />;
}

export function ActivitySummaryCard({
  item,
  focused,
  paneMode,
  status,
  onOpenPractice,
  onRegisterHeading = () => undefined,
}: ActivitySummaryCardProps): ReactNode {
  const savedDraft = status?.status === 'DRAFT';
  const inactiveStatus = status?.status && status.status !== 'AVAILABLE' ? status.status : null;
  const showStatus = focused || inactiveStatus !== null;
  const message = focused
    ? paneMode === 'collapsed'
      ? 'Activity đang tạm ẩn trong khu vực thực hành.'
      : 'Activity đang mở trong khu vực thực hành.'
    : item.activity.title;
  const action = focused
    ? paneMode === 'collapsed'
      ? 'Mở lại thực hành'
      : 'Quay lại thực hành'
    : 'Thực hành bài này';

  return (
    <section
      className={`syn-activity-summary${focused ? ' syn-activity-summary--active' : ''}`}
      data-activity-id={item.activity.id}
      data-activity-summary-card
      data-focused={focused || undefined}
    >
      <span className="syn-activity-summary__icon" data-activity-summary-icon aria-hidden="true">
        {summaryIcon(item.activity.kind)}
      </span>
      <div className="syn-activity-summary__content">
        <h3
          ref={(element) => onRegisterHeading(item.activity.id, element)}
          data-inline-activity-heading
          tabIndex={-1}
        >
          {item.activity.title}
        </h3>
        {showStatus ? (
          <p
            className="syn-activity-summary__status"
            data-activity-summary-status
            data-testid="activity-summary-status"
          >
            {focused ? (
              <>
                <span
                  className="syn-activity-summary__status-item"
                  data-activity-summary-status-item
                  data-tone="active"
                >
                  <span
                    className="syn-activity-summary__status-indicator"
                    data-activity-status-indicator
                    data-status="DRAFT"
                    aria-hidden="true"
                  >
                    <Circle size={9} fill="currentColor" />
                  </span>
                  <span>Đang làm</span>
                </span>
                {savedDraft ? (
                  <span
                    className="syn-activity-summary__status-item"
                    data-activity-summary-status-item
                    data-tone="saved"
                  >
                    <Check aria-hidden="true" size={12} />
                    <span>Đã lưu bản nháp</span>
                  </span>
                ) : null}
              </>
            ) : inactiveStatus ? (
              <span
                className="syn-activity-summary__status-item"
                data-activity-summary-status-item
                data-tone={inactiveStatus === 'PASSED' ? 'saved' : 'neutral'}
              >
                <span
                  className="syn-activity-summary__status-indicator"
                  data-activity-status-indicator
                  data-status={inactiveStatus}
                  aria-hidden="true"
                >
                  {inactiveStatus === 'PASSED' ? <Check size={12} /> : <Circle size={9} />}
                </span>
                <span>{activityStatusLabel(inactiveStatus)}</span>
              </span>
            ) : null}
          </p>
        ) : null}
        <p className="syn-activity-summary__description">{message}</p>
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => void onOpenPractice(item.activity.id).catch(() => undefined)}
      >
        {action}
        <ArrowRight data-activity-cta-icon aria-hidden="true" size={15} />
      </Button>
    </section>
  );
}
