import type { PracticePaneMode } from '@synaploom/protocol';
import type { WorkspaceViewport } from '#src/features/learning-workspace/useWorkspaceViewport';

export type WorkspaceEventName =
  | 'workspace.presentation.loaded'
  | 'workspace.activity.focused'
  | 'workspace.activity.switch_save_failed'
  | 'workspace.pane.collapsed'
  | 'workspace.pane.split'
  | 'workspace.pane.expanded'
  | 'workspace.presentation.conflict'
  | 'workspace.presentation.invalid_focus_recovered'
  | 'workspace.viewport.mapped';

export interface WorkspaceEvent {
  readonly name: WorkspaceEventName;
  readonly courseId: string;
  readonly ownerKind: 'lessons' | 'assessments';
  readonly ownerId: string;
  readonly activityId?: string;
  readonly paneMode?: PracticePaneMode;
  readonly revision?: number;
  readonly viewport?: WorkspaceViewport;
  readonly errorCode?: string;
}

export function sanitizeWorkspaceEvent(input: WorkspaceEvent): WorkspaceEvent {
  return {
    name: input.name,
    courseId: input.courseId,
    ownerKind: input.ownerKind,
    ownerId: input.ownerId,
    ...(input.activityId === undefined ? {} : { activityId: input.activityId }),
    ...(input.paneMode === undefined ? {} : { paneMode: input.paneMode }),
    ...(input.revision === undefined ? {} : { revision: input.revision }),
    ...(input.viewport === undefined ? {} : { viewport: input.viewport }),
    ...(input.errorCode === undefined ? {} : { errorCode: input.errorCode }),
  };
}

export function emitWorkspaceEvent(input: WorkspaceEvent): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('synaploom:workspace-event', { detail: sanitizeWorkspaceEvent(input) }),
  );
}
