import type { ProcessEvent } from '@synaploom/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openProcessEvents } from '#src/shared/api/client';

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
