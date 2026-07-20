import { useSyncExternalStore } from 'react';

export type WorkspaceViewport = 'wide-three' | 'wide-two' | 'compact' | 'mobile';
const WIDE_THREE_QUERY = '(min-width: 1440px)';
const WIDE_TWO_QUERY = '(min-width: 1180px)';
const COMPACT_QUERY = '(min-width: 720px)';

function viewport(): WorkspaceViewport {
  if (typeof matchMedia === 'undefined') return 'wide-three';
  if (matchMedia(WIDE_THREE_QUERY).matches) return 'wide-three';
  if (matchMedia(WIDE_TWO_QUERY).matches) return 'wide-two';
  if (matchMedia(COMPACT_QUERY).matches) return 'compact';
  return 'mobile';
}

function subscribe(listener: () => void): () => void {
  if (typeof matchMedia === 'undefined') return () => undefined;
  const queries = [
    matchMedia(WIDE_THREE_QUERY),
    matchMedia(WIDE_TWO_QUERY),
    matchMedia(COMPACT_QUERY),
  ];
  for (const query of queries) query.addEventListener('change', listener);
  return () => {
    for (const query of queries) query.removeEventListener('change', listener);
  };
}

export function useWorkspaceViewport(): WorkspaceViewport {
  return useSyncExternalStore(subscribe, viewport, () => 'wide-three');
}
