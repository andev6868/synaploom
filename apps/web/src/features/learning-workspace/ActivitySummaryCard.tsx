import type { ActivityStatusPayload, PracticePaneMode } from '@synaploom/protocol';
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

export function ActivitySummaryCard({
  item,
  focused,
  paneMode,
  status,
  onOpenPractice,
  onRegisterHeading = () => undefined,
}: ActivitySummaryCardProps): ReactNode {
  const savedDraft = status?.status === 'DRAFT';
  const statusText = focused
    ? savedDraft
      ? 'Đang làm · Đã lưu bản nháp'
      : 'Đang làm'
    : activityStatusLabel(status?.status ?? 'AVAILABLE');
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
      data-focused={focused || undefined}
    >
      <div className="syn-activity-summary__content">
        <h3
          ref={(element) => onRegisterHeading(item.activity.id, element)}
          data-inline-activity-heading
          tabIndex={-1}
        >
          {item.activity.title}
        </h3>
        <p className="syn-activity-summary__status">{statusText}</p>
        <p>{message}</p>
      </div>
      <button
        type="button"
        onClick={() => void onOpenPractice(item.activity.id).catch(() => undefined)}
      >
        {action}
      </button>
    </section>
  );
}
