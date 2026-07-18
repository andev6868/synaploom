import type { ActivityAnswer } from '@synaploom/contracts';
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { ActivityActions } from '#src/features/activity-engine/renderers/ActivityActions';
import type {
  PublicMultipleChoiceConfig,
  PublicSingleChoiceConfig,
} from '#src/features/activity-engine/renderers/config-types';
import type { ActivityRendererProps } from '#src/features/activity-engine/types';

function selectedSingle(answer: ActivityAnswer | null): string {
  return answer?.kind === 'single-choice' ? answer.optionId : '';
}

function selectedMultiple(answer: ActivityAnswer | null): readonly string[] {
  return answer?.kind === 'multiple-choice' ? answer.optionIds : [];
}

export function ChoiceActivity(props: ActivityRendererProps): ReactNode {
  if (props.activity.kind === 'single-choice') {
    return <SingleChoice {...props} />;
  }
  if (props.activity.kind === 'multiple-choice') {
    return <MultipleChoice {...props} />;
  }
  return <div role="alert">Cấu hình lựa chọn không hợp lệ.</div>;
}

function SingleChoice({
  activity,
  answer,
  disabled,
  onChange,
  onSaveDraft,
  onSubmit,
}: ActivityRendererProps): ReactNode {
  const config = activity.config as PublicSingleChoiceConfig;
  const selected = selectedSingle(answer);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const move = (event: KeyboardEvent<HTMLInputElement>, index: number): void => {
    if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (index + direction + config.options.length) % config.options.length;
    const next = config.options[nextIndex];
    if (!next) return;
    refs.current[nextIndex]?.focus();
    onChange({ kind: 'single-choice', optionId: next.id });
  };

  return (
    <div className="syn-activity-renderer">
      <div className="syn-activity-options">
        {config.options.map((option, index) => (
          <label key={option.id} className="syn-activity-option">
            <input
              ref={(node) => {
                refs.current[index] = node;
              }}
              type="radio"
              name={`activity-${activity.id}`}
              value={option.id}
              checked={selected === option.id}
              disabled={disabled}
              onChange={() => onChange({ kind: 'single-choice', optionId: option.id })}
              onKeyDown={(event) => move(event, index)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <ActivityActions
        canSubmit={selected.length > 0}
        disabled={disabled}
        onSaveDraft={onSaveDraft}
        onSubmit={onSubmit}
      />
    </div>
  );
}

function MultipleChoice({
  activity,
  answer,
  disabled,
  onChange,
  onSaveDraft,
  onSubmit,
}: ActivityRendererProps): ReactNode {
  const config = activity.config as PublicMultipleChoiceConfig;
  const selected = selectedMultiple(answer);
  const toggle = (optionId: string): void => {
    const next = selected.includes(optionId)
      ? selected.filter((id) => id !== optionId)
      : [...selected, optionId];
    onChange({ kind: 'multiple-choice', optionIds: next });
  };

  return (
    <div className="syn-activity-renderer">
      <p className="syn-activity-hint">Chọn tất cả đáp án phù hợp.</p>
      <div className="syn-activity-options">
        {config.options.map((option) => (
          <label key={option.id} className="syn-activity-option">
            <input
              type="checkbox"
              value={option.id}
              checked={selected.includes(option.id)}
              disabled={disabled}
              onChange={() => toggle(option.id)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <ActivityActions
        canSubmit={selected.length > 0}
        disabled={disabled}
        onSaveDraft={onSaveDraft}
        onSubmit={onSubmit}
      />
    </div>
  );
}
