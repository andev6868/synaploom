import { render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode, Ref } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { GroupImperativeHandle, Layout } from 'react-resizable-panels';

const panelProps: (ComponentProps<'section'> & {
  defaultSize?: number | string;
  minSize?: number | string;
  maxSize?: number | string;
  onResize?: unknown;
})[] = [];
let groupProps:
  | (ComponentProps<'div'> & {
      defaultLayout?: Layout;
      groupRef?: Ref<GroupImperativeHandle | null>;
      onLayoutChanged?: (layout: Layout) => void;
    })
  | undefined;

vi.mock('react-resizable-panels', () => ({
  Group: ({
    children,
    defaultLayout,
    groupRef,
    onLayoutChanged,
    ...props
  }: ComponentProps<'div'> & {
    readonly children?: ReactNode;
    readonly defaultLayout?: Layout;
    readonly groupRef?: Ref<GroupImperativeHandle | null>;
    readonly onLayoutChanged?: (layout: Layout) => void;
  }) => {
    groupProps = { defaultLayout, groupRef, onLayoutChanged, ...props };
    return <div {...props}>{children}</div>;
  },
  Panel: ({
    children,
    defaultSize,
    maxSize,
    minSize,
    onResize,
    ...props
  }: ComponentProps<'section'> & {
    readonly children?: ReactNode;
    readonly defaultSize?: number | string;
    readonly maxSize?: number | string;
    readonly minSize?: number | string;
    readonly onResize?: unknown;
  }) => {
    panelProps.push({ defaultSize, maxSize, minSize, onResize, ...props });
    return <section {...props}>{children}</section>;
  },
  Separator: (props: ComponentProps<'div'>) => <div {...props} />,
}));

import { WorkspaceShell } from '@synaploom/ui';

describe('WorkspaceShell percentage sizing', () => {
  it('lets the panel group own transient resizing and persists completed layouts', () => {
    panelProps.length = 0;
    groupProps = undefined;
    const onLessonSizeChange = vi.fn();

    render(
      <WorkspaceShell
        defaultLessonRatio={0.48}
        lesson="Lesson"
        practice="Practice"
        onLessonSizeChange={onLessonSizeChange}
      />,
    );

    expect(panelProps).toHaveLength(2);
    expect(panelProps[0]).toMatchObject({
      defaultSize: undefined,
      minSize: '32%',
      maxSize: '68%',
      onResize: undefined,
    });
    expect(panelProps[1]).toMatchObject({ minSize: '32%', onResize: undefined });

    const lessonPanelId = String(panelProps[0]?.id);
    const practicePanelId = String(panelProps[1]?.id);
    expect(groupProps?.defaultLayout).toEqual({
      [lessonPanelId]: 48,
      [practicePanelId]: 52,
    });

    groupProps?.onLayoutChanged?.({
      [lessonPanelId]: 60,
      [practicePanelId]: 40,
    });
    expect(onLessonSizeChange).toHaveBeenCalledWith(0.6);
  });

  it('renders an enabled navigator as a sibling of the resizable group', () => {
    render(
      <WorkspaceShell
        lesson="Lesson"
        practice="Practice"
        navigator={<button type="button">Activity A</button>}
        navigatorWidth={192}
      />,
    );

    const navigator = screen.getByTestId('workspace-navigator-zone');
    expect(navigator).toContainElement(screen.getByRole('button', { name: 'Activity A' }));
    expect(screen.getByRole('button', { name: 'Activity A' })).not.toBeDisabled();
    expect(navigator.previousElementSibling).toHaveClass('syn-workspace-shell');
    expect(navigator).toHaveStyle({ width: '192px' });
  });
});
