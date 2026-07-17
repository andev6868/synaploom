import type { ReactNode } from 'react';
import { classes } from '#ui/lib/classes';

/** Supported semantic badge states. */
export type StatusBadgeStatus = 'neutral' | 'active' | 'passed' | 'warning' | 'failed' | 'locked';

/** Public properties for a semantic status badge. */
export interface StatusBadgeProps {
  readonly status: StatusBadgeStatus;
  readonly children: ReactNode;
  readonly className?: string;
}

/** Displays compact state without relying on colour alone. */
export function StatusBadge({ children, className, status }: StatusBadgeProps): ReactNode {
  return (
    <span className={classes('syn-status-badge', `syn-status-badge--${status}`, className)}>
      {children}
    </span>
  );
}
