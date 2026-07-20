import type {
  ActivityOwner,
  UpdateWorkspacePresentationPayload,
  WorkspacePresentationState,
} from '@synaploom/protocol';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AppProviders } from '#src/app/providers/AppProviders';
import type { ActivityPersistenceHandle } from '#src/features/activity-engine/types';
import { flattenWorkspaceActivities } from '#src/features/learning-workspace/workspace-model';
import { useLearningWorkspaceController } from '#src/features/learning-workspace/useLearningWorkspaceController';
import { SynaploomApiError, type SynaploomApiClient } from '#src/shared/api/client';

const owner: ActivityOwner = { courseId: 'course', ownerKind: 'lessons', ownerId: 'lesson-a' };
const policy = {
  purpose: 'practice' as const,
  maxAttempts: null,
  feedbackMode: 'immediate' as const,
  revealAnswers: 'never' as const,
  scoring: 'points' as const,
  passingScore: null,
};
function activity(
  id: string,
  overrides: Partial<{
    allowInline: boolean;
    allowPractice: boolean;
    supportsFullscreen: boolean;
  }> = {},
) {
  return {
    id,
    kind: 'short-answer' as const,
    title: id,
    prompt: { blocks: [] },
    config: {},
    evaluation: { mode: 'automatic' as const, points: 1 },
    completion: { required: true },
    presentation: {
      defaultSurface: 'inline' as const,
      allowInline: overrides.allowInline ?? true,
      allowPractice: overrides.allowPractice ?? true,
      preferredWidth: 'compact' as const,
      supportsFullscreen: overrides.supportsFullscreen ?? false,
    },
  };
}
const activities = flattenWorkspaceActivities([
  {
    id: 'set',
    policy,
    activities: [
      { required: true, activity: activity('quiz-a') },
      { required: true, activity: activity('coding-lab', { supportsFullscreen: true }) },
      { required: false, activity: activity('reflection') },
      { required: false, activity: activity('inline-only', { allowPractice: false }) },
    ],
  },
]);
function state(overrides: Partial<WorkspacePresentationState> = {}): WorkspacePresentationState {
  return {
    courseId: 'course',
    ownerKind: 'lessons',
    ownerId: 'lesson-a',
    focusedActivityId: null,
    paneMode: 'collapsed',
    splitRatio: 0.45,
    userCollapsed: false,
    revision: 1,
    updatedAt: '2026-07-19T00:00:00Z',
    ...overrides,
  };
}
function api(
  updateWorkspacePresentation: SynaploomApiClient['updateWorkspacePresentation'],
): SynaploomApiClient {
  return { updateWorkspacePresentation } as SynaploomApiClient;
}
function wrapper(client: SynaploomApiClient) {
  return ({ children }: { readonly children: ReactNode }) => (
    <AppProviders api={client}>{children}</AppProviders>
  );
}
function dirtyHandle(calls: string[], id: string, error?: Error): ActivityPersistenceHandle {
  return {
    isDirty: () => true,
    saveIfDirty: async () => {
      calls.push(`save:${id}`);
      if (error) throw error;
    },
  };
}

describe('useLearningWorkspaceController', () => {
  it('saves the inline target before focusing it', async () => {
    const calls: string[] = [];
    const update = vi.fn(
      async (_owner: ActivityOwner, payload: UpdateWorkspacePresentationPayload) => {
        calls.push(`update:${payload.focusedActivityId}:${payload.paneMode}`);
        return state({ ...payload, revision: payload.revision + 1 });
      },
    );
    const { result } = renderHook(
      () => useLearningWorkspaceController({ owner, initialState: state(), activities }),
      { wrapper: wrapper(api(update)) },
    );
    act(() => result.current.registerPersistenceHandle('quiz-a', dirtyHandle(calls, 'quiz-a')));
    await act(() => result.current.focusActivity('quiz-a'));
    expect(calls).toEqual(['save:quiz-a', 'update:quiz-a:split']);
    expect(result.current.state.focusedActivityId).toBe('quiz-a');
  });

  it('blocks focus and collapse when current save fails', async () => {
    const update = vi.fn();
    const { result } = renderHook(
      () =>
        useLearningWorkspaceController({
          owner,
          initialState: state({ focusedActivityId: 'quiz-a', paneMode: 'split' }),
          activities,
        }),
      { wrapper: wrapper(api(update)) },
    );
    act(() =>
      result.current.registerPersistenceHandle(
        'quiz-a',
        dirtyHandle([], 'quiz-a', new Error('save failed')),
      ),
    );
    await act(async () => {
      await expect(result.current.focusActivity('coding-lab')).rejects.toThrow('save failed');
    });
    await act(async () => {
      await expect(result.current.collapsePracticePane()).rejects.toThrow('save failed');
    });
    expect(update).not.toHaveBeenCalled();
    expect(result.current.state.focusedActivityId).toBe('quiz-a');
    expect(result.current.saveStatus).toBe('error');
  });

  it('does not expose a return-inline transition', () => {
    const update = vi.fn();
    const { result } = renderHook(
      () => useLearningWorkspaceController({ owner, initialState: state(), activities }),
      { wrapper: wrapper(api(update)) },
    );
    expect('returnActivityInline' in result.current).toBe(false);
  });

  it('guards unsupported presentation transitions', async () => {
    const update = vi.fn();
    const { result } = renderHook(
      () => useLearningWorkspaceController({ owner, initialState: state(), activities }),
      { wrapper: wrapper(api(update)) },
    );
    await expect(act(() => result.current.focusActivity('inline-only'))).rejects.toThrow(
      /Practice Pane/,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('automatically rebases a conflicting intent onto the current server revision', async () => {
    const current = state({
      focusedActivityId: 'quiz-a',
      paneMode: 'split',
      splitRatio: 0.61,
      revision: 7,
    });
    const update = vi
      .fn()
      .mockRejectedValueOnce(
        new SynaploomApiError(
          'WORKSPACE_PRESENTATION_CONFLICT',
          'conflict',
          undefined,
          undefined,
          undefined,
          current,
        ),
      )
      .mockImplementation(
        async (_owner: ActivityOwner, payload: UpdateWorkspacePresentationPayload) =>
          state({ ...payload, revision: payload.revision + 1 }),
      );
    const { result } = renderHook(
      () =>
        useLearningWorkspaceController({
          owner,
          initialState: state({ focusedActivityId: 'quiz-a', paneMode: 'split' }),
          activities,
        }),
      { wrapper: wrapper(api(update)) },
    );

    await act(() => result.current.focusActivity('coding-lab'));

    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenLastCalledWith(
      owner,
      expect.objectContaining({
        focusedActivityId: 'coding-lab',
        paneMode: 'split',
        splitRatio: 0.61,
        revision: 7,
      }),
    );
    expect(result.current.state.focusedActivityId).toBe('coding-lab');
    expect(result.current.state.revision).toBe(8);
    expect(result.current.conflictState).toBeNull();
    expect(result.current.saveStatus).toBe('saved');
  });

  it('serializes concurrent transitions and rebases the later intent on the saved revision', async () => {
    let releaseFirst: ((value: WorkspacePresentationState) => void) | undefined;
    const first = new Promise<WorkspacePresentationState>((resolve) => {
      releaseFirst = resolve;
    });
    const update = vi
      .fn()
      .mockImplementationOnce(() => first)
      .mockImplementation(
        async (_owner: ActivityOwner, payload: UpdateWorkspacePresentationPayload) =>
          state({ ...payload, revision: payload.revision + 1 }),
      );
    const { result } = renderHook(
      () => useLearningWorkspaceController({ owner, initialState: state(), activities }),
      { wrapper: wrapper(api(update)) },
    );

    let focusPromise: Promise<void> | undefined;
    let collapsePromise: Promise<void> | undefined;
    act(() => {
      focusPromise = result.current.focusActivity('quiz-a');
      collapsePromise = result.current.collapsePracticePane();
    });

    await Promise.resolve();
    expect(update).toHaveBeenCalledTimes(1);
    releaseFirst?.(
      state({
        focusedActivityId: 'quiz-a',
        paneMode: 'split',
        userCollapsed: false,
        revision: 2,
      }),
    );
    await act(async () => Promise.all([focusPromise, collapsePromise]));

    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenNthCalledWith(
      2,
      owner,
      expect.objectContaining({
        focusedActivityId: 'quiz-a',
        paneMode: 'collapsed',
        userCollapsed: true,
        revision: 2,
      }),
    );
    expect(result.current.state.paneMode).toBe('collapsed');
    expect(result.current.state.revision).toBe(3);
  });

  it('moves only after explicit next selection', async () => {
    const update = vi.fn(
      async (_owner: ActivityOwner, payload: UpdateWorkspacePresentationPayload) =>
        state({ ...payload, revision: payload.revision + 1 }),
    );
    const { result } = renderHook(
      () =>
        useLearningWorkspaceController({
          owner,
          initialState: state({ focusedActivityId: 'coding-lab', paneMode: 'split' }),
          activities,
        }),
      { wrapper: wrapper(api(update)) },
    );
    expect(update).not.toHaveBeenCalled();
    await act(() => result.current.selectNextActivity());
    expect(update).toHaveBeenCalledWith(
      owner,
      expect.objectContaining({ focusedActivityId: 'reflection' }),
    );
  });
  it('does not let a stale renderer cleanup remove the replacement persistence handle', async () => {
    const calls: string[] = [];
    const update = vi.fn(
      async (_owner: ActivityOwner, payload: UpdateWorkspacePresentationPayload) =>
        state({ ...payload, revision: payload.revision + 1 }),
    );
    const { result } = renderHook(
      () =>
        useLearningWorkspaceController({
          owner,
          initialState: state({ focusedActivityId: 'coding-lab', paneMode: 'split' }),
          activities,
        }),
      { wrapper: wrapper(api(update)) },
    );
    const oldHandle = dirtyHandle(calls, 'old');
    const replacementHandle = dirtyHandle(calls, 'replacement');
    act(() => {
      result.current.registerPersistenceHandle('coding-lab', oldHandle);
      result.current.registerPersistenceHandle('coding-lab', replacementHandle);
      result.current.registerPersistenceHandle('coding-lab', null, oldHandle);
    });

    await act(() => result.current.collapsePracticePane());

    expect(calls).toEqual(['save:replacement']);
  });

  it('moves focus through registered headings only after successful transitions', async () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    const update = vi.fn(
      async (_owner: ActivityOwner, payload: UpdateWorkspacePresentationPayload) =>
        state({ ...payload, revision: payload.revision + 1 }),
    );
    const { result } = renderHook(
      () => useLearningWorkspaceController({ owner, initialState: state(), activities }),
      { wrapper: wrapper(api(update)) },
    );
    const practiceHeading = document.createElement('h2');
    practiceHeading.tabIndex = -1;
    document.body.append(practiceHeading);
    act(() => result.current.registerPracticeHeading('quiz-a', practiceHeading));
    await act(() => result.current.focusActivity('quiz-a'));
    expect(document.activeElement).toBe(practiceHeading);
    vi.unstubAllGlobals();
  });

  it('keeps focus inside the current activity when save-before-switch fails', async () => {
    const update = vi.fn();
    const { result } = renderHook(
      () =>
        useLearningWorkspaceController({
          owner,
          initialState: state({ focusedActivityId: 'quiz-a', paneMode: 'split' }),
          activities,
        }),
      { wrapper: wrapper(api(update)) },
    );
    const currentControl = document.createElement('button');
    document.body.append(currentControl);
    currentControl.focus();
    act(() =>
      result.current.registerPersistenceHandle(
        'quiz-a',
        dirtyHandle([], 'quiz-a', new Error('save failed')),
      ),
    );
    await act(async () => {
      await expect(result.current.focusActivity('coding-lab')).rejects.toThrow('save failed');
    });
    expect(document.activeElement).toBe(currentControl);
  });
});
