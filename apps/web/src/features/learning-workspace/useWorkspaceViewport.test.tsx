import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useWorkspaceViewport } from '#src/features/learning-workspace/useWorkspaceViewport';

const listeners = new Map<string, Set<() => void>>();
const matches = new Map<string, boolean>();
function installMatchMedia(): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    matches: matches.get(query) ?? false,
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => {
      const set = listeners.get(query) ?? new Set();
      set.add(listener);
      listeners.set(query, set);
    },
    removeEventListener: (_type: string, listener: () => void) =>
      listeners.get(query)?.delete(listener),
    dispatchEvent: () => true,
  }));
}
afterEach(() => {
  vi.unstubAllGlobals();
  listeners.clear();
  matches.clear();
});

it('maps revision two viewport bands and cleans listeners', () => {
  matches.set('(min-width: 1440px)', true);
  installMatchMedia();
  const hook = renderHook(() => useWorkspaceViewport());
  expect(hook.result.current).toBe('wide-three');
  act(() => {
    matches.set('(min-width: 1440px)', false);
    matches.set('(min-width: 1180px)', true);
    for (const set of listeners.values()) for (const listener of set) listener();
  });
  expect(hook.result.current).toBe('wide-two');
  act(() => {
    matches.set('(min-width: 1180px)', false);
    matches.set('(min-width: 720px)', true);
    for (const set of listeners.values()) for (const listener of set) listener();
  });
  expect(hook.result.current).toBe('compact');
  act(() => {
    matches.set('(min-width: 720px)', false);
    for (const set of listeners.values()) for (const listener of set) listener();
  });
  expect(hook.result.current).toBe('mobile');
  hook.unmount();
  expect([...listeners.values()].every((set) => set.size === 0)).toBe(true);
});
