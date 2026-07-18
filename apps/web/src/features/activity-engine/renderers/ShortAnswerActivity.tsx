import type { ReactNode } from 'react';
import { ActivityActions } from '#src/features/activity-engine/renderers/ActivityActions';
import type { PublicShortAnswerConfig } from '#src/features/activity-engine/renderers/config-types';
import type { ActivityRendererProps } from '#src/features/activity-engine/types';

export function ShortAnswerActivity({
  activity,
  answer,
  disabled,
  onChange,
  onSaveDraft,
  onSubmit,
}: ActivityRendererProps): ReactNode {
  const config = activity.config as PublicShortAnswerConfig;
  const value = answer?.kind === 'short-answer' ? answer.value : '';
  return (
    <div className="syn-activity-renderer">
      <label className="syn-activity-field">
        <span>Câu trả lời</span>
        <input
          type="text"
          value={value}
          maxLength={config.maximumLength}
          disabled={disabled}
          onChange={(event) => onChange({ kind: 'short-answer', value: event.currentTarget.value })}
        />
      </label>
      <ActivityActions
        canSubmit={value.trim().length > 0}
        disabled={disabled}
        onSaveDraft={onSaveDraft}
        onSubmit={onSubmit}
      />
    </div>
  );
}
