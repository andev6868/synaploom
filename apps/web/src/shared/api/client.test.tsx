import type { ProcessEvent } from '@synaploom/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient, openProcessEvents, SynaploomApiError } from '#src/shared/api/client';

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

const terminalEvent: ProcessEvent = {
  type: 'process.exited',
  sessionId: 'session-1',
  lessonId: 'event-loop',
  timestamp: '2026-07-16T00:00:00.000Z',
  exitCode: 0,
  outputTruncated: false,
};

describe('openProcessEvents', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('closes the SSE connection after the terminal event to prevent automatic reconnects', () => {
    const events: ProcessEvent[] = [];
    const disconnect = vi.fn();

    openProcessEvents('/api/processes/session-1/events', (event) => events.push(event), disconnect);
    const source = FakeEventSource.instances[0];
    expect(source).toBeDefined();

    source?.emit(terminalEvent);

    expect(events).toEqual([terminalEvent]);
    expect(source?.close).toHaveBeenCalledTimes(1);
    expect(disconnect).not.toHaveBeenCalled();
  });
});

describe('hierarchical API client', () => {
  it('requests canonical navigation, lesson, and assessment endpoints', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      void input;
      return new Response('{}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const client = createApiClient(fetchImpl as typeof fetch);

    await client.getNavigation('perf');
    await client.getLessonView('perf', 'runtime', 'event-loop');
    await client.getChapterAssessment('runtime', 'capstone');

    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/courses/perf/navigation',
      '/api/v1/courses/perf/chapters/runtime/lessons/event-loop',
      '/api/v1/chapters/runtime/assessments/capstone',
    ]);
  });

  it('preserves locked-item metadata on typed errors', async () => {
    const blockingRequirements = [
      {
        id: 'reading',
        kind: 'reading',
        required: true,
        satisfied: false,
        attempted: false,
        latestPassed: null,
      },
    ] as const;
    const currentTarget = {
      type: 'LESSON',
      id: 'event-loop',
      chapterId: 'runtime',
      label: 'Event Loop',
    } as const;
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            code: 'ITEM_LOCKED',
            message: 'Item is locked.',
            blockingRequirements,
            currentTarget,
          }),
          { status: 409, headers: { 'content-type': 'application/json' } },
        ),
    );

    const error = await createApiClient(fetchImpl as typeof fetch)
      .getNavigation('perf')
      .catch((value: unknown) => value);

    expect(error).toBeInstanceOf(SynaploomApiError);
    expect(error).toMatchObject({ code: 'ITEM_LOCKED', blockingRequirements, currentTarget });
  });
});
