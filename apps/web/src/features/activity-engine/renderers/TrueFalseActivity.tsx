import type { ReactNode } from 'react';
import { ActivityActions } from '#src/features/activity-engine/renderers/ActivityActions';
import type { ActivityRendererProps } from '#src/features/activity-engine/types';

export function TrueFalseActivity({
  activity,
  answer,
  disabled,
  onChange,
  onSaveDraft,
  onSubmit,
}: ActivityRendererProps): ReactNode {
  const selected = answer?.kind === 'true-false' ? answer.value : null;
  return (
    <div className="syn-activity-renderer">
      <div className="syn-activity-options syn-activity-options--horizontal">
        {[
          { label: 'Đúng', value: true },
          { label: 'Sai', value: false },
        ].map((option) => (
          <label key={option.label} className="syn-activity-option">
            <input
              type="radio"
              name={`activity-${activity.id}`}
              checked={selected === option.value}
              disabled={disabled}
              onChange={() => onChange({ kind: 'true-false', value: option.value })}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <ActivityActions
        canSubmit={selected !== null}
        disabled={disabled}
        onSaveDraft={onSaveDraft}
        onSubmit={onSubmit}
      />
    </div>
  );
}
