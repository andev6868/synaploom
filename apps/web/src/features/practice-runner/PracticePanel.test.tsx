import type { ProcessEvent } from '@synaploom/contracts';
import type { LessonPayload } from '@synaploom/protocol';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef, useMemo, useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '#src/app/providers/AppProviders';
import {
  PracticePanel,
  type PracticePanelHandle,
} from '#src/features/practice-runner/PracticePanel';
import type { SynaploomApiClient } from '#src/shared/api/client';

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  onerror: (() => void) | null = null;
  close = vi.fn();
  private readonly listeners = new Map<string, EventListener[]>();

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  emit(event: ProcessEvent): void {
    const message = { data: JSON.stringify(event) } as MessageEvent<string>;
    for (const listener of this.listeners.get('process') ?? []) listener(message);
  }
}

const lesson: LessonPayload = {
  id: 'event-loop',
  title: 'Event Loop',
  position: 2,
  type: 'mixed',
  estimatedMinutes: 20,
  blocks: [],
  status: 'IN_PROGRESS',
  readingAcknowledged: true,
  latestCheck: null,
  exercise: {
    id: 'event-loop-practice',
    title: 'Quan sát Event Loop',
    editable: ['event-loop.js'],
    actions: [{ id: 'run', label: 'Chạy chương trình' }],
    checks: [],
  },
};

function fakeApi(): SynaploomApiClient {
  return {
    getNavigation: () => Promise.reject(new Error('not used')),
    getLessonView: () => Promise.reject(new Error('not used')),
    getChapterAssessment: () => Promise.reject(new Error('not used')),
    recordChapterAssessment: () => Promise.reject(new Error('not used')),
    getCourse: () => Promise.reject(new Error('not used')),
    getWorkspacePresentation: () =>
      Promise.resolve({
        courseId: 'course',
        ownerKind: 'lessons' as const,
        ownerId: 'lesson',
        focusedActivityId: null,
        paneMode: 'collapsed' as const,
        splitRatio: 0.45,
        userCollapsed: false,
        revision: 0,
        updatedAt: '',
      }),
    updateWorkspacePresentation: (_owner, payload) =>
      Promise.resolve({
        ...{
          courseId: 'course',
          ownerKind: 'lessons' as const,
          ownerId: 'lesson',
          focusedActivityId: null,
          paneMode: 'collapsed' as const,
          splitRatio: 0.45,
          userCollapsed: false,
          revision: 0,
          updatedAt: '',
        },
        ...payload,
        revision: payload.revision + 1,
      }),
    getActivityStatuses: () => Promise.resolve([]),
    getActivitySets: () => Promise.resolve([]),
    getActivity: () => Promise.reject(new Error('not used')),
    getCurrentActivityAttempt: () => Promise.resolve(null),
    saveActivityDraft: () => Promise.reject(new Error('not used')),
    submitActivityAttempt: () => Promise.reject(new Error('not used')),
    getActivitySetProgress: () => Promise.reject(new Error('not used')),
    getCurrentLesson: () => Promise.reject(new Error('not used')),
    getLesson: () => Promise.reject(new Error('not used')),
    startLesson: () => Promise.resolve(),
    acknowledgeReading: () => Promise.resolve(),
    completeLesson: () => Promise.reject(new Error('not used')),
    listFiles: () => Promise.resolve(['event-loop.js']),
    readFile: () => Promise.resolve({ path: 'event-loop.js', content: 'console.log("ok");' }),
    writeFile: () => Promise.resolve(),
    resetWorkspace: () => Promise.resolve(),
    runAction: () =>
      Promise.resolve({
        sessionId: 'session-1',
        eventsUrl: '/api/processes/session-1/events',
      }),
    requestAi: () => Promise.resolve({ status: 'disabled', message: 'disabled' }),
    getPaneRatio: () => Promise.resolve(0.48),
    setPaneRatio: (ratio) => Promise.resolve(ratio),
  };
}

const terminalEvent: ProcessEvent = {
  type: 'process.exited',
  sessionId: 'session-1',
  lessonId: 'event-loop',
  timestamp: '2026-07-16T00:00:00.000Z',
  exitCode: 0,
  outputTruncated: false,
};

describe('PracticePanel', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('notifies completion once per process session even when the callback identity changes', async () => {
    const api = fakeApi();
    const onActionComplete = vi.fn();
    const view = render(
      <AppProviders api={api}>
        <PracticePanel lesson={lesson} onActionComplete={() => onActionComplete()} />
      </AppProviders>,
    );

    expect(await screen.findByDisplayValue('console.log("ok");')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Chạy chương trình' }));

    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    FakeEventSource.instances[0]?.emit(terminalEvent);
    await waitFor(() => expect(onActionComplete).toHaveBeenCalledTimes(1));

    view.rerender(
      <AppProviders api={api}>
        <PracticePanel lesson={lesson} onActionComplete={() => onActionComplete()} />
      </AppProviders>,
    );

    await waitFor(() => expect(onActionComplete).toHaveBeenCalledTimes(1));
  });

  it('projects coding actions and marks the contained surface', async () => {
    function Harness(): ReactNode {
      const [actions, setActions] = useState<ReactNode>(null);
      const outlet = useMemo(() => ({ setActions }), []);
      return (
        <>
          <PracticePanel
            lesson={lesson}
            onActionComplete={vi.fn()}
            surface="practice-contained"
            actionOutlet={outlet}
          />
          <footer data-testid="coding-actions">{actions}</footer>
        </>
      );
    }
    render(
      <AppProviders api={fakeApi()}>
        <Harness />
      </AppProviders>,
    );
    expect(await screen.findByDisplayValue('console.log("ok");')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Chạy chương trình' })).toBeVisible();
    expect(screen.getByTestId('coding-actions')).toContainElement(
      screen.getByRole('button', { name: 'Chạy chương trình' }),
    );
    expect(document.querySelector('[data-activity-surface="practice-contained"]')).toHaveClass(
      'syn-practice-panel--contained',
    );
  });
  it('does not access workspace APIs when the lesson has no exercise', async () => {
    const api = fakeApi();
    const listFiles = vi.spyOn(api, 'listFiles');
    render(
      <AppProviders api={api}>
        <PracticePanel lesson={{ ...lesson, exercise: null }} onActionComplete={vi.fn()} />
      </AppProviders>,
    );

    expect(screen.getByText('Không có bài thực hành')).toBeVisible();
    await waitFor(() => expect(listFiles).not.toHaveBeenCalled());
  });
  it('exposes dirty state and saves the current activity file', async () => {
    const client = fakeApi();
    const writeActivityFile = vi.fn(() => Promise.resolve());
    client.listActivityFiles = () => Promise.resolve(['index.js']);
    client.readActivityFile = () => Promise.resolve({ path: 'index.js', content: 'initial' });
    client.writeActivityFile = writeActivityFile;
    const ref = createRef<PracticePanelHandle>();

    render(
      <AppProviders api={client}>
        <PracticePanel
          ref={ref}
          lesson={lesson}
          workspaceTarget={{
            courseId: 'course',
            ownerKind: 'lessons',
            ownerId: 'lesson',
            activityId: 'coding-lab',
          }}
          onActionComplete={vi.fn()}
        />
      </AppProviders>,
    );

    const editor = await screen.findByDisplayValue('initial');
    fireEvent.change(editor, { target: { value: 'changed source' } });
    expect(ref.current?.isDirty()).toBe(true);
    await ref.current?.saveIfDirty();
    expect(writeActivityFile).toHaveBeenCalledWith(
      expect.objectContaining({ activityId: 'coding-lab' }),
      'index.js',
      'changed source',
    );
    await waitFor(() => expect(ref.current?.isDirty()).toBe(false));
  });

  it('keeps coding content dirty when persistence fails', async () => {
    const client = fakeApi();
    client.listActivityFiles = () => Promise.resolve(['index.js']);
    client.readActivityFile = () => Promise.resolve({ path: 'index.js', content: 'initial' });
    client.writeActivityFile = vi.fn(() => Promise.reject(new Error('write failed')));
    const ref = createRef<PracticePanelHandle>();

    render(
      <AppProviders api={client}>
        <PracticePanel
          ref={ref}
          lesson={lesson}
          workspaceTarget={{
            courseId: 'course',
            ownerKind: 'lessons',
            ownerId: 'lesson',
            activityId: 'coding-lab',
          }}
          onActionComplete={vi.fn()}
        />
      </AppProviders>,
    );

    fireEvent.change(await screen.findByDisplayValue('initial'), {
      target: { value: 'changed source' },
    });
    await expect(ref.current?.saveIfDirty()).rejects.toThrow('write failed');
    expect(ref.current?.isDirty()).toBe(true);
  });

  it('preserves dirty content when an equivalent workspace target is re-created', async () => {
    const client = fakeApi();
    const readActivityFile = vi.fn(() => Promise.resolve({ path: 'index.js', content: 'initial' }));
    client.listActivityFiles = () => Promise.resolve(['index.js']);
    client.readActivityFile = readActivityFile;
    const ref = createRef<PracticePanelHandle>();
    const view = render(
      <AppProviders api={client}>
        <PracticePanel
          ref={ref}
          lesson={lesson}
          workspaceTarget={{
            courseId: 'course',
            ownerKind: 'lessons',
            ownerId: 'lesson',
            activityId: 'coding-lab',
          }}
          onActionComplete={vi.fn()}
        />
      </AppProviders>,
    );

    const editor = await screen.findByDisplayValue('initial');
    fireEvent.change(editor, { target: { value: 'changed source' } });

    view.rerender(
      <AppProviders api={client}>
        <PracticePanel
          ref={ref}
          lesson={lesson}
          workspaceTarget={{
            courseId: 'course',
            ownerKind: 'lessons',
            ownerId: 'lesson',
            activityId: 'coding-lab',
          }}
          onActionComplete={vi.fn()}
        />
      </AppProviders>,
    );

    await waitFor(() => expect(readActivityFile).toHaveBeenCalledTimes(1));
    expect(editor).toHaveValue('changed source');
    expect(ref.current?.isDirty()).toBe(true);
  });
});
