import type { ReactNode } from 'react';
import { ActivityActions } from '#src/features/activity-engine/renderers/ActivityActions';
import type { PublicMatchingConfig } from '#src/features/activity-engine/renderers/config-types';
import type { ActivityRendererProps } from '#src/features/activity-engine/types';

export function MatchingActivity({
  activity,
  answer,
  disabled,
  onChange,
  onSaveDraft,
  onSubmit,
}: ActivityRendererProps): ReactNode {
  const config = activity.config as PublicMatchingConfig;
  const pairs = answer?.kind === 'matching' ? answer.pairs : {};
  const update = (leftId: string, rightId: string): void => {
    const next = rightId
      ? { ...pairs, [leftId]: rightId }
      : Object.fromEntries(Object.entries(pairs).filter(([id]) => id !== leftId));
    onChange({ kind: 'matching', pairs: next });
  };
  const complete = config.left.every((left) => Boolean(pairs[left.id]));

  return (
    <div className="syn-activity-renderer">
      <div className="syn-activity-matching">
        {config.left.map((left) => (
          <label key={left.id} className="syn-activity-field syn-activity-matching__row">
            <span>Ghép với {left.label}</span>
            <select
              value={pairs[left.id] ?? ''}
              disabled={disabled}
              onChange={(event) => update(left.id, event.currentTarget.value)}
            >
              <option value="">Chọn đáp án</option>
              {config.right.map((right) => (
                <option key={right.id} value={right.id}>
                  {right.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <ActivityActions
        canSubmit={complete}
        disabled={disabled}
        onSaveDraft={onSaveDraft}
        onSubmit={onSubmit}
      />
    </div>
  );
}
