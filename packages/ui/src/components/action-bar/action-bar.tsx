import type { ReactNode } from 'react';

/** Anchors the primary learner actions to the bottom of the practice pane. */
export function ActionBar({ children }: { readonly children: ReactNode }): ReactNode {
  return <footer className="syn-action-bar">{children}</footer>;
}
