import { describe, expect, it } from 'vitest';
import { resolveWorkspaceLayout } from '#src/features/workspace-layout/activity-layout';

describe('resolveWorkspaceLayout', () => {
  it.each([
    [{ hasDocument: true, embeddedKinds: [], focusedKind: null }, 'reading'],
    [{ hasDocument: true, embeddedKinds: ['single-choice'], focusedKind: null }, 'inline-activity'],
    [{ hasDocument: false, embeddedKinds: [], focusedKind: 'writing' }, 'focused-activity'],
    [{ hasDocument: true, embeddedKinds: [], focusedKind: 'coding' }, 'split-coding'],
  ] as const)('resolves %o as %s', (input, expected) => {
    expect(resolveWorkspaceLayout(input)).toBe(expected);
  });
});
