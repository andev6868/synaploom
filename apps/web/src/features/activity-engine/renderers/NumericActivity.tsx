import type { ReactNode } from 'react';
import { ActivityActions } from '#src/features/activity-engine/renderers/ActivityActions';
import type { PublicNumericConfig } from '#src/features/activity-engine/renderers/config-types';
import type { ActivityRendererProps } from '#src/features/activity-engine/types';

export function NumericActivity({
  activity,
  answer,
  disabled,
  onChange,
  onSaveDraft,
  onSubmit,
}: ActivityRendererProps): ReactNode {
  const config = activity.config as PublicNumericConfig;
  const value = answer?.kind === 'numeric' ? answer.value : '';
  const unit = answer?.kind === 'numeric' ? (answer.unit ?? '') : '';
  const update = (nextValue: string, nextUnit: string): void => {
    onChange({ kind: 'numeric', value: nextValue, ...(nextUnit ? { unit: nextUnit } : {}) });
  };
  const complete = value.trim().length > 0 && (!config.requireUnit || unit.length > 0);

  return (
    <div className="syn-activity-renderer">
      <div className="syn-activity-numeric">
        <label className="syn-activity-field">
          <span>Giá trị hoặc biểu thức</span>
          <input
            type="text"
            inputMode="decimal"
            value={value}
            disabled={disabled}
            onChange={(event) => update(event.currentTarget.value, unit)}
          />
        </label>
        {config.unit ? (
          <label className="syn-activity-field syn-activity-field--unit">
            <span>Đơn vị</span>
            <select
              value={unit}
              disabled={disabled}
              required={config.requireUnit}
              onChange={(event) => update(value, event.currentTarget.value)}
            >
              <option value="">Chọn đơn vị</option>
              <option value={config.unit}>{config.unit}</option>
            </select>
          </label>
        ) : null}
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
