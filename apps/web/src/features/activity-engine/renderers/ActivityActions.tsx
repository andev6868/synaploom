import type { ReactNode } from 'react';

export function ActivityActions({
  canSubmit,
  disabled,
  submitLabel = 'Kiểm tra đáp án',
  onSaveDraft,
  onSubmit,
}: {
  readonly canSubmit: boolean;
  readonly disabled: boolean;
  readonly submitLabel?: string;
  readonly onSaveDraft: () => Promise<void>;
  readonly onSubmit: () => Promise<void>;
}): ReactNode {
  return (
    <div className="syn-activity-actions">
      <button
        type="button"
        className="syn-activity-actions__secondary"
        disabled={disabled || !canSubmit}
        onClick={() => {
          void onSaveDraft().catch(() => undefined);
        }}
      >
        Lưu bản nháp
      </button>
      <button
        type="button"
        className="syn-activity-actions__primary"
        disabled={disabled || !canSubmit}
        onClick={() => {
          void onSubmit().catch(() => undefined);
        }}
      >
        {submitLabel}
      </button>
    </div>
  );
}
