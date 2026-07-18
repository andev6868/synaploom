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

  it('requests navigation in the context of the viewed assessment', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('{}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const client = createApiClient(fetchImpl as typeof fetch);

    await client.getNavigation('perf', {
      kind: 'assessment',
      chapterId: 'runtime',
      id: 'runtime-checkpoint',
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/v1/courses/perf/navigation?viewedKind=assessment&viewedId=runtime-checkpoint&chapterId=runtime',
      expect.any(Object),
    );
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

describe('activity API client', () => {
  it('builds owner-qualified activity URLs and request methods', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return new Response('null', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const client = createApiClient(fetchImpl as typeof fetch);
    const owner = {
      courseId: 'multi domain',
      ownerKind: 'lessons' as const,
      ownerId: 'intro lesson',
    };

    await client.getActivitySets(owner);
    await client.getActivity(owner, 'quiz one');
    await client.getCurrentActivityAttempt(owner, 'quiz one');
    await client.saveActivityDraft(owner, 'quiz one', {
      answer: { kind: 'single-choice', optionId: 'a' },
      revision: 2,
      randomSeed: 7,
    });
    await client.submitActivityAttempt(owner, 'quiz one', {
      answer: { kind: 'single-choice', optionId: 'a' },
      idempotencyKey: 'submit-1',
      randomSeed: 7,
    });
    await client.getActivitySetProgress(owner, 'practice set');

    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/courses/multi%20domain/lessons/intro%20lesson/activity-sets',
      '/api/v1/courses/multi%20domain/lessons/intro%20lesson/activities/quiz%20one',
      '/api/v1/courses/multi%20domain/lessons/intro%20lesson/activities/quiz%20one/attempts/current',
      '/api/v1/courses/multi%20domain/lessons/intro%20lesson/activities/quiz%20one/attempts/current/draft',
      '/api/v1/courses/multi%20domain/lessons/intro%20lesson/activities/quiz%20one/attempts',
      '/api/v1/courses/multi%20domain/lessons/intro%20lesson/activity-sets/practice%20set/progress',
    ]);
    expect(fetchImpl.mock.calls[3]?.[1]).toMatchObject({ method: 'PUT' });
    expect(fetchImpl.mock.calls[4]?.[1]).toMatchObject({ method: 'POST' });
  });
});
