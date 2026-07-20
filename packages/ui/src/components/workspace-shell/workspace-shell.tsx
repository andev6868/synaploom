import { useCallback, useId, useMemo, type CSSProperties, type ReactNode } from 'react';
import { Group, Panel, Separator, type Layout } from 'react-resizable-panels';

const MIN_RATIO = 32;
const MAX_RATIO = 68;

/**
 * react-resizable-panels v4 interprets numeric panel constraints as pixels.
 * Explicit percentage units keep the learning panes proportional to the viewport.
 */
function toPanelPercentage(value: number): `${number}%` {
  return `${value}%`;
}

/** Clamps the lesson pane percentage to the focused-workspace design range. */
export function clampWorkspaceRatio(value: number): number {
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, value));
}

/** Public properties for the primary two-pane learning workspace. */
export interface WorkspaceShellProps {
  readonly lesson: ReactNode;
  readonly practice: ReactNode;
  readonly navigator?: ReactNode;
  readonly navigatorWidth?: number;
  readonly defaultLessonRatio?: number;
  readonly onLessonSizeChange?: (ratio: number) => void;
}

/**
 * Provides resizable, independently scrollable lesson and practice panes.
 *
 * The panel group owns transient pointer and keyboard interactions. React is notified only
 * after a completed layout change, which prevents re-renders from interrupting an active drag.
 */
export function WorkspaceShell({
  defaultLessonRatio = 0.48,
  lesson,
  navigator,
  navigatorWidth = 224,
  onLessonSizeChange,
  practice,
}: WorkspaceShellProps): ReactNode {
  const instanceId = useId().replaceAll(':', '');
  const lessonPanelId = `lesson-${instanceId}`;
  const practicePanelId = `practice-${instanceId}`;
  const initialLessonSize = useMemo(
    () => clampWorkspaceRatio(defaultLessonRatio * 100),
    [defaultLessonRatio],
  );
  const defaultLayout = useMemo<Layout>(
    () => ({
      [lessonPanelId]: initialLessonSize,
      [practicePanelId]: 100 - initialLessonSize,
    }),
    [initialLessonSize, lessonPanelId, practicePanelId],
  );

  const persistLayout = useCallback(
    (layout: Layout) => {
      const lessonSize = layout[lessonPanelId];
      if (typeof lessonSize === 'number') {
        onLessonSizeChange?.(clampWorkspaceRatio(lessonSize) / 100);
      }
    },
    [lessonPanelId, onLessonSizeChange],
  );

  const navigatorStyle = { width: `${navigatorWidth}px` } satisfies CSSProperties;
  return (
    <div className="syn-workspace-frame">
      <Group
        className="syn-workspace-shell"
        defaultLayout={defaultLayout}
        id={`workspace-${instanceId}`}
        onLayoutChanged={persistLayout}
        orientation="horizontal"
      >
        <Panel
          className="syn-workspace-shell__pane"
          id={lessonPanelId}
          minSize={toPanelPercentage(MIN_RATIO)}
          maxSize={toPanelPercentage(MAX_RATIO)}
        >
          {lesson}
        </Panel>
        <Separator
          aria-label="Thay đổi kích thước hai vùng học"
          className="syn-workspace-shell__separator"
          id={`separator-${instanceId}`}
        />
        <Panel
          className="syn-workspace-shell__pane"
          data-workspace-practice-zone
          id={practicePanelId}
          minSize={toPanelPercentage(MIN_RATIO)}
        >
          {practice}
        </Panel>
      </Group>
      {navigator === undefined ? null : (
        <aside
          className="syn-workspace-frame__navigator"
          data-testid="workspace-navigator-zone"
          data-workspace-navigator-zone
          style={navigatorStyle}
        >
          {navigator}
        </aside>
      )}
    </div>
  );
}
