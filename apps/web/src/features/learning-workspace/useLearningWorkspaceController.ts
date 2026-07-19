import type {
  ActivityOwner,
  UpdateWorkspacePresentationPayload,
  WorkspacePresentationState,
} from '@synaploom/protocol';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApi } from '#src/app/providers/AppProviders';
import type { ActivityPersistenceHandle } from '#src/features/activity-engine/types';
import {
  findNextActivityId,
  findWorkspaceActivity,
  type ResolvedWorkspaceActivity,
} from '#src/features/learning-workspace/workspace-model';
import { emitWorkspaceEvent } from '#src/features/learning-workspace/workspace-events';
import { SynaploomApiError } from '#src/shared/api/client';

export type WorkspaceSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';
export type WorkspaceTransitionKind =
  'focus' | 'return-inline' | 'collapse' | 'expand' | 'restore-split' | 'resize' | 'next';

export interface WorkspaceTransitionIntent {
  readonly kind: WorkspaceTransitionKind;
  readonly payload: UpdateWorkspacePresentationPayload;
}

export interface LearningWorkspaceController {
  readonly state: WorkspacePresentationState;
  readonly saveStatus: WorkspaceSaveStatus;
  readonly error: Error | null;
  readonly conflictState: WorkspacePresentationState | null;
  readonly focusedActivity: ResolvedWorkspaceActivity | null;
  readonly registerPersistenceHandle: (
    activityId: string,
    handle: ActivityPersistenceHandle | null,
    removedHandle?: ActivityPersistenceHandle,
  ) => void;
  registerPracticeHeading(activityId: string, element: HTMLElement | null): void;
  registerInlineHeading(activityId: string, element: HTMLElement | null): void;
  focusActivity(activityId: string): Promise<void>;
  returnActivityInline(): Promise<void>;
  collapsePracticePane(): Promise<void>;
  expandPracticePane(): Promise<void>;
  restoreSplitPane(): Promise<void>;
  setSplitRatio(ratio: number): Promise<void>;
  selectNextActivity(): Promise<void>;
  retryLastSave(): Promise<void>;
}

interface Options {
  readonly owner: ActivityOwner;
  readonly initialState: WorkspacePresentationState;
  readonly activities: readonly ResolvedWorkspaceActivity[];
}

export function workspacePresentationKey(owner: ActivityOwner): readonly unknown[] {
  return ['workspace-presentation', owner.courseId, owner.ownerKind, owner.ownerId];
}

export function activityStatusesKey(owner: ActivityOwner): readonly unknown[] {
  return ['activity-statuses', owner.courseId, owner.ownerKind, owner.ownerId];
}

export function useLearningWorkspaceController({
  owner,
  initialState,
  activities,
}: Options): LearningWorkspaceController {
  const api = useApi();
  const queryClient = useQueryClient();
  const [state, setState] = useState(initialState);
  const [saveStatus, setSaveStatus] = useState<WorkspaceSaveStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [conflictState, setConflictState] = useState<WorkspacePresentationState | null>(null);
  const stateRef = useRef(initialState);
  const conflictStateRef = useRef<WorkspacePresentationState | null>(null);
  const handlesRef = useRef(new Map<string, ActivityPersistenceHandle>());
  const practiceHeadingsRef = useRef(new Map<string, HTMLElement>());
  const inlineHeadingsRef = useRef(new Map<string, HTMLElement>());
  const lastIntentRef = useRef<WorkspaceTransitionIntent | null>(null);

  const publishState = useCallback(
    (next: WorkspacePresentationState): void => {
      stateRef.current = next;
      setState(next);
      queryClient.setQueryData(workspacePresentationKey(owner), next);
    },
    [owner, queryClient],
  );

  const publishConflict = useCallback((next: WorkspacePresentationState | null): void => {
    conflictStateRef.current = next;
    setConflictState(next);
  }, []);

  const registerPersistenceHandle = useCallback(
    (
      activityId: string,
      handle: ActivityPersistenceHandle | null,
      removedHandle?: ActivityPersistenceHandle,
    ): void => {
      if (handle) {
        handlesRef.current.set(activityId, handle);
        return;
      }
      if (!removedHandle || handlesRef.current.get(activityId) === removedHandle) {
        handlesRef.current.delete(activityId);
      }
    },
    [],
  );

  const registerPracticeHeading = useCallback(
    (activityId: string, element: HTMLElement | null): void => {
      if (element) practiceHeadingsRef.current.set(activityId, element);
      else practiceHeadingsRef.current.delete(activityId);
    },
    [],
  );
  const registerInlineHeading = useCallback(
    (activityId: string, element: HTMLElement | null): void => {
      if (element) inlineHeadingsRef.current.set(activityId, element);
      else inlineHeadingsRef.current.delete(activityId);
    },
    [],
  );
  const scheduleFocus = useCallback((resolveElement: () => HTMLElement | undefined): void => {
    const schedule =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (callback: FrameRequestCallback): number => {
            callback(0);
            return 0;
          };
    schedule(() => resolveElement()?.focus());
  }, []);

  useEffect(() => {
    emitWorkspaceEvent({
      name: 'workspace.presentation.loaded',
      courseId: owner.courseId,
      ownerKind: owner.ownerKind,
      ownerId: owner.ownerId,
      paneMode: initialState.paneMode,
      revision: initialState.revision,
      ...(initialState.focusedActivityId ? { activityId: initialState.focusedActivityId } : {}),
    });
  }, [initialState.focusedActivityId, initialState.paneMode, initialState.revision, owner]);

  const transition = useCallback(
    async (intent: WorkspaceTransitionIntent): Promise<void> => {
      const currentId = stateRef.current.focusedActivityId;
      const saveId = currentId ?? intent.payload.focusedActivityId;
      const handle = saveId ? handlesRef.current.get(saveId) : undefined;
      lastIntentRef.current = intent;
      setError(null);
      setSaveStatus('saving');
      try {
        if (handle?.isDirty()) await handle.saveIfDirty();
        const saved = await api.updateWorkspacePresentation(owner, intent.payload);
        publishState(saved);
        publishConflict(null);
        setSaveStatus('saved');
        lastIntentRef.current = null;
        if (intent.kind === 'return-inline' && currentId) {
          scheduleFocus(() => inlineHeadingsRef.current.get(currentId));
        } else if (saved.focusedActivityId && saved.paneMode !== 'collapsed') {
          scheduleFocus(() => practiceHeadingsRef.current.get(saved.focusedActivityId as string));
        }
        const eventName =
          intent.kind === 'focus' || intent.kind === 'next'
            ? 'workspace.activity.focused'
            : intent.kind === 'expand'
              ? 'workspace.pane.expanded'
              : intent.kind === 'restore-split' || intent.kind === 'resize'
                ? 'workspace.pane.split'
                : 'workspace.pane.collapsed';
        emitWorkspaceEvent({
          name: eventName,
          courseId: owner.courseId,
          ownerKind: owner.ownerKind,
          ownerId: owner.ownerId,
          paneMode: saved.paneMode,
          revision: saved.revision,
          ...(saved.focusedActivityId ? { activityId: saved.focusedActivityId } : {}),
        });
      } catch (cause) {
        const nextError =
          cause instanceof Error ? cause : new Error('Workspace transition failed.');
        setError(nextError);
        if (
          cause instanceof SynaploomApiError &&
          cause.code === 'WORKSPACE_PRESENTATION_CONFLICT' &&
          cause.currentWorkspacePresentation
        ) {
          publishConflict(cause.currentWorkspacePresentation);
          setSaveStatus('conflict');
        } else {
          setSaveStatus('error');
        }
        emitWorkspaceEvent({
          name:
            cause instanceof SynaploomApiError && cause.code === 'WORKSPACE_PRESENTATION_CONFLICT'
              ? 'workspace.presentation.conflict'
              : 'workspace.activity.switch_save_failed',
          courseId: owner.courseId,
          ownerKind: owner.ownerKind,
          ownerId: owner.ownerId,
          paneMode: stateRef.current.paneMode,
          revision: stateRef.current.revision,
          ...(currentId ? { activityId: currentId } : {}),
          errorCode: cause instanceof SynaploomApiError ? cause.code : nextError.name,
        });
        throw nextError;
      }
    },
    [api, owner, publishConflict, publishState, scheduleFocus],
  );

  const payload = useCallback(
    (
      overrides: Partial<UpdateWorkspacePresentationPayload>,
    ): UpdateWorkspacePresentationPayload => ({
      focusedActivityId: stateRef.current.focusedActivityId,
      paneMode: stateRef.current.paneMode,
      splitRatio: stateRef.current.splitRatio,
      userCollapsed: stateRef.current.userCollapsed,
      revision: stateRef.current.revision,
      ...overrides,
    }),
    [],
  );

  const focusActivity = useCallback(
    async (activityId: string): Promise<void> => {
      const target = findWorkspaceActivity(activities, activityId);
      if (!target) throw new Error(`Không tìm thấy hoạt động ${activityId}.`);
      if (!target.activity.presentation.allowPractice) {
        throw new Error('Hoạt động này không hỗ trợ Practice Pane.');
      }
      await transition({
        kind: 'focus',
        payload: payload({
          focusedActivityId: activityId,
          paneMode: 'split',
          userCollapsed: false,
        }),
      });
    },
    [activities, payload, transition],
  );

  const returnActivityInline = useCallback(async (): Promise<void> => {
    const current = findWorkspaceActivity(activities, stateRef.current.focusedActivityId);
    if (current && !current.activity.presentation.allowInline) {
      throw new Error('Hoạt động này không hỗ trợ chế độ inline.');
    }
    await transition({
      kind: 'return-inline',
      payload: payload({ focusedActivityId: null, paneMode: 'collapsed', userCollapsed: false }),
    });
  }, [activities, payload, transition]);

  const collapsePracticePane = useCallback(async (): Promise<void> => {
    await transition({
      kind: 'collapse',
      payload: payload({ paneMode: 'collapsed', userCollapsed: true }),
    });
  }, [payload, transition]);

  const expandPracticePane = useCallback(async (): Promise<void> => {
    const current = findWorkspaceActivity(activities, stateRef.current.focusedActivityId);
    if (!current?.activity.presentation.supportsFullscreen) {
      throw new Error('Hoạt động này không hỗ trợ chế độ toàn màn hình.');
    }
    await transition({
      kind: 'expand',
      payload: payload({ paneMode: 'expanded', userCollapsed: false }),
    });
  }, [activities, payload, transition]);

  const restoreSplitPane = useCallback(async (): Promise<void> => {
    if (!stateRef.current.focusedActivityId) return;
    await transition({
      kind: 'restore-split',
      payload: payload({ paneMode: 'split', userCollapsed: false }),
    });
  }, [payload, transition]);

  const setSplitRatio = useCallback(
    async (ratio: number): Promise<void> => {
      await transition({ kind: 'resize', payload: payload({ splitRatio: ratio }) });
    },
    [payload, transition],
  );

  const selectNextActivity = useCallback(async (): Promise<void> => {
    const currentId = stateRef.current.focusedActivityId;
    if (!currentId) return;
    const nextId = findNextActivityId(activities, currentId);
    if (!nextId) return;
    await focusActivity(nextId);
  }, [activities, focusActivity]);

  const retryLastSave = useCallback(async (): Promise<void> => {
    const intent = lastIntentRef.current;
    if (!intent) return;
    const revision = conflictStateRef.current?.revision ?? stateRef.current.revision;
    await transition({ ...intent, payload: { ...intent.payload, revision } });
  }, [transition]);

  const focusedActivity = useMemo(
    () => findWorkspaceActivity(activities, state.focusedActivityId),
    [activities, state.focusedActivityId],
  );

  return {
    state,
    saveStatus,
    error,
    conflictState,
    focusedActivity,
    registerPersistenceHandle,
    registerPracticeHeading,
    registerInlineHeading,
    focusActivity,
    returnActivityInline,
    collapsePracticePane,
    expandPracticePane,
    restoreSplitPane,
    setSplitRatio,
    selectNextActivity,
    retryLastSave,
  };
}
