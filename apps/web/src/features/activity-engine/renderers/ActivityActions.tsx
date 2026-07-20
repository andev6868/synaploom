import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import type {
  ActivityActionOutlet,
  ActivityHostSurface,
} from '#src/features/activity-engine/types';

interface ProjectionContextValue {
  readonly surface: ActivityHostSurface;
  readonly outlet?: ActivityActionOutlet;
}

const ProjectionContext = createContext<ProjectionContextValue>({ surface: 'standalone' });

export function ActivityActionProjectionProvider({
  surface,
  outlet,
  children,
}: ProjectionContextValue & { readonly children: ReactNode }): ReactNode {
  const value = useMemo(
    () => ({ surface, ...(outlet === undefined ? {} : { outlet }) }),
    [outlet, surface],
  );
  return <ProjectionContext.Provider value={value}>{children}</ProjectionContext.Provider>;
}

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
  const { surface, outlet } = useContext(ProjectionContext);
  const onSaveDraftRef = useRef(onSaveDraft);
  const onSubmitRef = useRef(onSubmit);

  useEffect(() => {
    onSaveDraftRef.current = onSaveDraft;
  }, [onSaveDraft]);

  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  const actions = useMemo(
    () => (
      <div className="syn-activity-actions">
        <button
          type="button"
          className="syn-activity-actions__secondary"
          disabled={disabled || !canSubmit}
          onClick={() => void onSaveDraftRef.current().catch(() => undefined)}
        >
          Lưu bản nháp
        </button>
        <button
          type="button"
          className="syn-activity-actions__primary"
          disabled={disabled || !canSubmit}
          onClick={() => void onSubmitRef.current().catch(() => undefined)}
        >
          {submitLabel}
        </button>
      </div>
    ),
    [canSubmit, disabled, submitLabel],
  );

  useEffect(() => {
    if (surface !== 'practice-contained' || outlet === undefined) return undefined;
    outlet.setActions(actions);
    return () => outlet.setActions(null);
  }, [actions, outlet, surface]);

  return surface === 'practice-contained' && outlet !== undefined ? null : actions;
}
