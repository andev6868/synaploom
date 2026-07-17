import type { ProcessEvent } from '@synaploom/contracts';
import type { LessonPayload } from '@synaploom/protocol';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '#src/app/providers/AppProviders';
import { PracticePanel } from '#src/features/practice-runner/PracticePanel';
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
    getCourse: () => Promise.reject(new Error('not used')),
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
});
