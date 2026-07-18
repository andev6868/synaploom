import type { ReactNode } from 'react';
import { ActivityActions } from '#src/features/activity-engine/renderers/ActivityActions';
import type { PublicWritingConfig } from '#src/features/activity-engine/renderers/config-types';
import type { ActivityRendererProps } from '#src/features/activity-engine/types';

export function WritingActivity({
  activity,
  answer,
  disabled,
  onChange,
  onSaveDraft,
  onSubmit,
}: ActivityRendererProps): ReactNode {
  const config = activity.config as PublicWritingConfig;
  const value = answer?.kind === 'writing' ? answer.value : '';
  const withinRange =
    value.length >= config.minimumCharacters && value.length <= config.maximumCharacters;
  return (
    <div className="syn-activity-renderer">
      {config.outlinePrompts && config.outlinePrompts.length > 0 ? (
        <aside className="syn-activity-writing__outline" aria-label="Gợi ý dàn ý">
          <h4>Gợi ý dàn ý</h4>
          <ul>
            {config.outlinePrompts.map((prompt) => (
              <li key={prompt}>{prompt}</li>
            ))}
          </ul>
        </aside>
      ) : null}
      <label className="syn-activity-field">
        <span>Bài viết</span>
        <textarea
          value={value}
          minLength={config.minimumCharacters}
          maxLength={config.maximumCharacters}
          disabled={disabled}
          rows={10}
          onChange={(event) => onChange({ kind: 'writing', value: event.currentTarget.value })}
        />
      </label>
      <p role="status" aria-live="polite" className="syn-activity-writing__count">
        {value.length}/{config.maximumCharacters} ký tự
        {value.length < config.minimumCharacters ? ` · tối thiểu ${config.minimumCharacters}` : ''}
      </p>
      <ActivityActions
        canSubmit={withinRange}
        disabled={disabled}
        submitLabel="Nộp bài viết"
        onSaveDraft={onSaveDraft}
        onSubmit={onSubmit}
      />
    </div>
  );
}
