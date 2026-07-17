import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { runGoHarness } from './go-runner';

beforeAll(async () => {
  await import('node:fs/promises').then(({ mkdir }) => mkdir('.tmp', { recursive: true }));
});

function loadReference(name: 'run' | 'check') {
  return JSON.parse(
    readFileSync(`tests/conformance/reference/node-0.1.x/process/${name}-events.json`, 'utf8'),
  ) as { events: Array<Record<string, unknown>> };
}

describe('Go runner parity', () => {
  it.each(['run', 'check'] as const)('%s matches the Node event fixture', (name) => {
    expect(runGoHarness(name)).toEqual(loadReference(name));
  });

  it.each([
    ['timeout', 'process.timed_out'],
    ['failed-start', 'process.failed_to_start'],
  ] as const)('%s emits one terminal event', (name, terminalType) => {
    const result = runGoHarness(name);
    const terminals = result.events.filter((event) =>
      ['process.exited', 'process.timed_out', 'process.killed', 'process.failed_to_start'].includes(
        String(event.type),
      ),
    );
    expect(terminals).toHaveLength(1);
    expect(terminals[0]?.type).toBe(terminalType);
  });
});
