import type { ActivityStatusPayload, ActivityOwner, PracticePaneMode } from '@synaploom/protocol';
import type { ReactNode } from 'react';
import { ActivityHost } from '#src/features/activity-engine/ActivityHost';
import type { ActivityHostProps } from '#src/features/activity-engine/types';
import { activityStatusLabel } from '#src/features/learning-workspace/ActivityTray';
import type { ResolvedWorkspaceActivity } from '#src/features/learning-workspace/workspace-model';

export interface InlineActivitySlotProps {
  readonly item: ResolvedWorkspaceActivity;
  readonly owner: ActivityOwner;
  readonly focused: boolean;
  readonly paneMode: PracticePaneMode;
  readonly status: ActivityStatusPayload | null;
  readonly onOpenPractice: (activityId: string) => Promise<void>;
  readonly onProgressChanged: () => Promise<void> | void;
  readonly onPersistenceHandleChange: NonNullable<ActivityHostProps['onPersistenceHandleChange']>;
  readonly onRegisterInlineHeading?: (activityId: string, element: HTMLElement | null) => void;
  readonly renderHost?: (props: ActivityHostProps) => ReactNode;
}

export function InlineActivitySlot({
  item,
  owner,
  focused,
  paneMode,
  status,
  onOpenPractice,
  onProgressChanged,
  onPersistenceHandleChange,
  onRegisterInlineHeading = () => undefined,
  renderHost = (props) => <ActivityHost {...props} />,
}: InlineActivitySlotProps): ReactNode {
  if (focused) {
    return (
      <section
        className="syn-inline-activity-summary"
        data-activity-id={item.activity.id}
        aria-labelledby={`inline-summary-${item.activity.id}`}
      >
        <h3
          ref={(element) => onRegisterInlineHeading(item.activity.id, element)}
          id={`inline-summary-${item.activity.id}`}
          data-inline-activity-heading
          tabIndex={-1}
        >
          {item.activity.title}
        </h3>
        <p>{activityStatusLabel(status?.status ?? 'AVAILABLE')}</p>
        <p>
          {paneMode === 'collapsed'
            ? `${item.activity.title} đang tạm ẩn.`
            : `${item.activity.title} đang mở trong khu vực thực hành.`}
        </p>
        <button
          type="button"
          onClick={() => {
            void onOpenPractice(item.activity.id).catch(() => undefined);
          }}
        >
          {paneMode === 'collapsed' ? 'Mở lại khu vực thực hành' : 'Đi tới khu vực thực hành'}
        </button>
      </section>
    );
  }

  if (!item.activity.presentation.allowInline) {
    return (
      <section className="syn-inline-activity-launch" data-activity-id={item.activity.id}>
        <h3
          ref={(element) => onRegisterInlineHeading(item.activity.id, element)}
          data-inline-activity-heading
          tabIndex={-1}
        >
          {item.activity.title}
        </h3>
        <p>{activityStatusLabel(status?.status ?? 'AVAILABLE')}</p>
        {item.activity.presentation.allowPractice ? (
          <button
            type="button"
            onClick={() => {
              void onOpenPractice(item.activity.id).catch(() => undefined);
            }}
          >
            Mở khu vực thực hành
          </button>
        ) : null}
      </section>
    );
  }

  const hostProps: ActivityHostProps = {
    owner,
    activity: item.activity,
    policy: item.policy,
    onProgressChanged,
    onPersistenceHandleChange,
  };
  return (
    <section className="syn-inline-activity-slot" data-activity-id={item.activity.id}>
      <h3
        ref={(element) => onRegisterInlineHeading(item.activity.id, element)}
        data-inline-activity-heading
        tabIndex={-1}
      >
        {item.activity.title}
      </h3>
      {renderHost(hostProps)}
      {item.activity.presentation.allowPractice ? (
        <button
          type="button"
          onClick={() => {
            void onOpenPractice(item.activity.id).catch(() => undefined);
          }}
        >
          Mở trong khu vực thực hành
        </button>
      ) : null}
    </section>
  );
}
