import type { ReactNode } from 'react';
import { ActivityActions } from '#src/features/activity-engine/renderers/ActivityActions';
import type { PublicFillBlanksConfig } from '#src/features/activity-engine/renderers/config-types';
import type { ActivityRendererProps } from '#src/features/activity-engine/types';

export function FillBlanksActivity({
  activity,
  answer,
  disabled,
  onChange,
  onSaveDraft,
  onSubmit,
}: ActivityRendererProps): ReactNode {
  const config = activity.config as PublicFillBlanksConfig;
  const values = answer?.kind === 'fill-blanks' ? answer.values : {};
  const update = (id: string, value: string): void => {
    onChange({ kind: 'fill-blanks', values: { ...values, [id]: value } });
  };
  const complete = config.blanks.every((blank) => (values[blank.id] ?? '').trim().length > 0);

  return (
    <div className="syn-activity-renderer">
      <div className="syn-activity-fields">
        {config.blanks.map((blank) => {
          const descriptionId = `${activity.id}-${blank.id}-description`;
          const inputId = `${activity.id}-${blank.id}`;
          return (
            <div key={blank.id} className="syn-activity-field">
              <label htmlFor={inputId}>{blank.label}</label>
              <input
                id={inputId}
                type="text"
                value={values[blank.id] ?? ''}
                aria-describedby={descriptionId}
                disabled={disabled}
                onChange={(event) => update(blank.id, event.currentTarget.value)}
              />
              <span id={descriptionId} className="syn-activity-field__description">
                Điền câu trả lời cho ô {blank.label}.
              </span>
            </div>
          );
        })}
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
