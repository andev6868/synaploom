import type { ActivityOwner, PracticePaneMode } from '@synaploom/protocol';
import { Dialog, WorkspaceShell } from '@synaploom/ui';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { emitWorkspaceEvent } from '#src/features/learning-workspace/workspace-events';
import { useWorkspaceViewport } from '#src/features/learning-workspace/useWorkspaceViewport';

export interface LearningWorkspaceShellProps {
  readonly mode: PracticePaneMode;
  readonly splitRatio: number;
  readonly theory: ReactNode;
  readonly practice: ReactNode;
  readonly practiceRail: ReactNode;
  readonly theoryRail: ReactNode;
  readonly practiceTitle: string;
  readonly navigator?: ReactNode;
  readonly assistant?: ReactNode;
  readonly onSplitRatioCommit: (ratio: number) => Promise<void> | void;
  readonly onCloseMobilePractice: () => Promise<void> | void;
  readonly eventOwner?: ActivityOwner;
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
  navigator,
  assistant,
  onSplitRatioCommit,
  onCloseMobilePractice,
  eventOwner,
}: LearningWorkspaceShellProps): ReactNode {
  const viewport = useWorkspaceViewport();
  const [compactSurface, setCompactSurface] = useState<CompactSurface>(() =>
    mode === 'expanded' ? 'practice' : mode === 'split' ? 'split' : 'theory',
  );
  const theoryScrollTopRef = useRef(0);
  const theoryScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!eventOwner) return;
    emitWorkspaceEvent({
      name: 'workspace.viewport.mapped',
      courseId: eventOwner.courseId,
      ownerKind: eventOwner.ownerKind,
      ownerId: eventOwner.ownerId,
      viewport,
      paneMode: mode,
    });
  }, [eventOwner, mode, viewport]);

  const wideViewport = viewport === 'wide-three' || viewport === 'wide-two';
  const theoryVisible = wideViewport
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
    <div
      className="syn-learning-workspace__theory"
      data-workspace-theory-zone
      ref={theoryScrollRef}
    >
      {theory}
    </div>
  );

  const compose = (workspace: ReactNode): ReactNode => (
    <div className="syn-learning-workspace-layout" data-testid="workspace-layout">
      <div
        className="syn-learning-workspace-layout__main"
        data-testid="workspace-main"
        data-workspace-main
      >
        {workspace}
      </div>
      {assistant === undefined ? null : (
        <div className="syn-learning-workspace-layout__assistant" data-testid="workspace-assistant">
          {assistant}
        </div>
      )}
    </div>
  );

  if (viewport === 'mobile') {
    return compose(
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
      </main>,
    );
  }

  if (viewport === 'compact') {
    return compose(
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
      </main>,
    );
  }

  if (mode === 'split') {
    return compose(
      <WorkspaceShell
        defaultLessonRatio={splitRatio}
        lesson={theoryPane}
        practice={practice}
        {...(viewport === 'wide-three' && navigator !== undefined ? { navigator } : {})}
        onLessonSizeChange={(ratio) => {
          void Promise.resolve(onSplitRatioCommit(ratio)).catch(() => undefined);
        }}
      />,
    );
  }
  if (mode === 'expanded') {
    return compose(
      <main className="syn-learning-workspace syn-learning-workspace--expanded">
        {theoryRail}
        {practice}
        {viewport === 'wide-three' && navigator !== undefined ? (
          <aside className="syn-learning-workspace__expanded-navigator">{navigator}</aside>
        ) : null}
      </main>,
    );
  }
  return compose(
    <main className="syn-learning-workspace syn-learning-workspace--collapsed">
      {theoryPane}
      {practiceRail}
    </main>,
  );
}
