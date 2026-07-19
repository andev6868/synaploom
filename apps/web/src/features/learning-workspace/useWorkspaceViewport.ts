import { useSyncExternalStore } from 'react';

export type WorkspaceViewport = 'wide' | 'compact' | 'mobile';
const WIDE_QUERY = '(min-width: 1100px)';
const COMPACT_QUERY = '(min-width: 720px)';

function viewport(): WorkspaceViewport {
  if (typeof matchMedia === 'undefined') return 'wide';
  if (matchMedia(WIDE_QUERY).matches) return 'wide';
  if (matchMedia(COMPACT_QUERY).matches) return 'compact';
  return 'mobile';
}

function subscribe(listener: () => void): () => void {
  if (typeof matchMedia === 'undefined') return () => undefined;
  const queries = [matchMedia(WIDE_QUERY), matchMedia(COMPACT_QUERY)];
  for (const query of queries) query.addEventListener('change', listener);
  return () => {
    for (const query of queries) query.removeEventListener('change', listener);
  };
}

export function useWorkspaceViewport(): WorkspaceViewport {
  return useSyncExternalStore(subscribe, viewport, () => 'wide');
}
