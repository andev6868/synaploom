import { GripVertical } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { ActivityActions } from '#src/features/activity-engine/renderers/ActivityActions';
import {
  optionById,
  type PublicOrderingConfig,
} from '#src/features/activity-engine/renderers/config-types';
import type { ActivityRendererProps } from '#src/features/activity-engine/types';

export function OrderingActivity({
  activity,
  answer,
  disabled,
  onChange,
  onSaveDraft,
  onSubmit,
}: ActivityRendererProps): ReactNode {
  const config = activity.config as PublicOrderingConfig;
  const itemIds =
    answer?.kind === 'ordering' ? answer.itemIds : config.items.map((item) => item.id);
  const [announcement, setAnnouncement] = useState('');

  const move = (index: number, direction: -1 | 1): void => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= itemIds.length) return;
    const next = [...itemIds];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(nextIndex, 0, moved);
    onChange({ kind: 'ordering', itemIds: next });
    const label = optionById(config.items, moved)?.label ?? moved;
    setAnnouncement(`${label} ở vị trí ${nextIndex + 1}`);
  };

  return (
    <div className="syn-activity-renderer">
      <p className="syn-activity-ordering__instruction">
        Kéo và thả để sắp xếp theo trình tự đúng.
      </p>
      <ol className="syn-activity-ordering">
        {itemIds.map((id, index) => {
          const label = optionById(config.items, id)?.label ?? id;
          return (
            <li key={id}>
              <span
                className="syn-activity-ordering__drag-handle"
                data-ordering-drag-handle
                aria-hidden="true"
              >
                <GripVertical size={18} />
              </span>
              <span className="syn-activity-ordering__label">{label}</span>
              <span className="syn-activity-ordering__actions">
                <button
                  type="button"
                  disabled={disabled || index === 0}
                  aria-label={`Di chuyển ${label} lên`}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={disabled || index === itemIds.length - 1}
                  aria-label={`Di chuyển ${label} xuống`}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </button>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="syn-visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
      <ActivityActions
        canSubmit={itemIds.length > 0}
        disabled={disabled}
        onSaveDraft={onSaveDraft}
        onSubmit={onSubmit}
      />
    </div>
  );
}
