import type { ActivityAnswer } from '@synaploom/contracts';
import type { ReactNode } from 'react';
import { ActivityFeedback } from '#src/features/activity-engine/ActivityFeedback';
import type { ActivityHostProps } from '#src/features/activity-engine/types';
import { useActivityAttempt } from '#src/features/activity-engine/useActivityAttempt';

function PlaceholderActivity({ kind, onChange }: { readonly kind: ActivityAnswer['kind']; readonly onChange: (answer: ActivityAnswer) => void }): ReactNode {
  return (
    <div className="syn-activity-host__placeholder" data-activity-kind={kind}>
      <p>Hoạt động {kind} đã sẵn sàng.</p>
      <button type="button" hidden onClick={() => onChange({ kind: 'writing', value: '' })}>Khởi tạo</button>
    </div>
  );
}

function renderKnownActivity(kind: ActivityHostProps['activity']['kind'], onChange: (answer: ActivityAnswer) => void): ReactNode {
  switch (kind) {
    case 'single-choice':
    case 'multiple-choice':
    case 'true-false':
    case 'short-answer':
    case 'fill-blanks':
    case 'ordering':
    case 'matching':
    case 'numeric':
    case 'writing':
    case 'coding':
      return <PlaceholderActivity kind={kind} onChange={onChange} />;
    default:
      return <div role="alert">Loại hoạt động này chưa được hỗ trợ.</div>;
  }
}

export function ActivityHost({ owner, activity, policy, onProgressChanged }: ActivityHostProps): ReactNode {
  const controller = useActivityAttempt({ owner, activityId: activity.id, policy, onProgressChanged });
  return (
    <section className="syn-activity-host" aria-busy={controller.state === 'loading' || controller.state === 'submitting'}>
      <fieldset disabled={controller.disabled} aria-label={activity.title}>
        <legend>{activity.title}</legend>
        {renderKnownActivity(activity.kind, controller.setAnswer)}
      </fieldset>
      {controller.state === 'loading' ? <p>Đang tải hoạt động…</p> : null}
      {controller.state === 'error' && controller.error ? <p role="alert">{controller.error.message}</p> : null}
      {controller.state === 'max-attempt' ? <p role="alert">Bạn đã sử dụng hết số lần làm bài.</p> : null}
      {controller.attempt?.feedback ? <ActivityFeedback feedback={controller.attempt.feedback} /> : null}
    </section>
  );
}
