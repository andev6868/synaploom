import type { PracticePaneMode } from '@synaploom/protocol';
import { Dialog, WorkspaceShell } from '@synaploom/ui';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useWorkspaceViewport } from '#src/features/learning-workspace/useWorkspaceViewport';

export interface LearningWorkspaceShellProps {
  readonly mode: PracticePaneMode;
  readonly splitRatio: number;
  readonly theory: ReactNode;
  readonly practice: ReactNode;
  readonly practiceRail: ReactNode;
  readonly theoryRail: ReactNode;
  readonly practiceTitle: string;
  readonly onSplitRatioCommit: (ratio: number) => Promise<void> | void;
  readonly onCloseMobilePractice: () => Promise<void> | void;
}

type CompactSurface = 'theory' | 'split' | 'practice';

export function LearningWorkspaceShell({
  mode,
  splitRatio,
  theory,
  practice,
  practiceRail,
  theoryRail,
  practiceTitle,
  onSplitRatioCommit,
  onCloseMobilePractice,
}: LearningWorkspaceShellProps): ReactNode {
  const viewport = useWorkspaceViewport();
  const [compactSurface, setCompactSurface] = useState<CompactSurface>(() =>
    mode === 'expanded' ? 'practice' : mode === 'split' ? 'split' : 'theory',
  );
  const theoryScrollTopRef = useRef(0);
  const theoryScrollRef = useRef<HTMLDivElement | null>(null);
  const theoryVisible =
    viewport === 'wide'
      ? mode !== 'expanded'
      : viewport === 'compact'
        ? compactSurface !== 'practice'
        : true;

  useLayoutEffect(() => {
    const element = theoryScrollRef.current;
    if (!element || !theoryVisible) return undefined;
    element.scrollTop = theoryScrollTopRef.current;
    return () => {
      theoryScrollTopRef.current = element.scrollTop;
    };
  }, [theoryVisible, viewport, mode, compactSurface]);

  const theoryPane = (
    <div className="syn-learning-workspace__theory" ref={theoryScrollRef}>
      {theory}
    </div>
  );

  if (viewport === 'mobile') {
    return (
      <main className="syn-learning-workspace syn-learning-workspace--mobile">
        {theoryPane}
        {mode === 'collapsed' ? practiceRail : null}
        <Dialog
          title={practiceTitle}
          open={mode !== 'collapsed'}
          onOpenChange={(open) => {
            if (!open) void Promise.resolve(onCloseMobilePractice()).catch(() => undefined);
          }}
          contentClassName="syn-learning-workspace__mobile-practice"
        >
          {practice}
        </Dialog>
      </main>
    );
  }

  if (viewport === 'compact') {
    return (
      <main className="syn-learning-workspace syn-learning-workspace--compact">
        <div className="syn-learning-workspace__segments" aria-label="Chọn vùng học">
          {(['theory', 'split', 'practice'] as const).map((surface) => (
            <button
              key={surface}
              type="button"
              aria-pressed={compactSurface === surface}
              onClick={() => setCompactSurface(surface)}
            >
              {surface === 'theory' ? 'Lý thuyết' : surface === 'split' ? 'Chia đôi' : 'Thực hành'}
            </button>
          ))}
        </div>
        <div
          className={`syn-learning-workspace__compact-content syn-learning-workspace__compact-content--${compactSurface}`}
        >
          {compactSurface !== 'practice' ? theoryPane : null}
          {compactSurface !== 'theory' && mode !== 'collapsed' ? practice : null}
          {mode === 'collapsed' ? practiceRail : null}
        </div>
      </main>
    );
  }

  if (mode === 'split') {
    return (
      <WorkspaceShell
        defaultLessonRatio={splitRatio}
        lesson={theoryPane}
        practice={practice}
        onLessonSizeChange={(ratio) => {
          void Promise.resolve(onSplitRatioCommit(ratio)).catch(() => undefined);
        }}
      />
    );
  }
  if (mode === 'expanded') {
    return (
      <main className="syn-learning-workspace syn-learning-workspace--expanded">
        {theoryRail}
        {practice}
      </main>
    );
  }
  return (
    <main className="syn-learning-workspace syn-learning-workspace--collapsed">
      {theoryPane}
      {practiceRail}
    </main>
  );
}
