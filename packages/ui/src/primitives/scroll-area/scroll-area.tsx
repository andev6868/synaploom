import * as RadixScrollArea from '@radix-ui/react-scroll-area';
import type { ComponentProps, ReactNode } from 'react';
import { classes } from '#ui/lib/classes';

/** A styled scroll viewport that preserves native keyboard and wheel behavior. */
export function ScrollArea({
  className,
  children,
  ...props
}: ComponentProps<typeof RadixScrollArea.Root>): ReactNode {
  return (
    <RadixScrollArea.Root className={classes('syn-scroll-area', className)} {...props}>
      <RadixScrollArea.Viewport className="syn-scroll-area__viewport">
        {children}
      </RadixScrollArea.Viewport>
      <RadixScrollArea.Scrollbar className="syn-scroll-area__scrollbar" orientation="vertical">
        <RadixScrollArea.Thumb className="syn-scroll-area__thumb" />
      </RadixScrollArea.Scrollbar>
      <RadixScrollArea.Corner />
    </RadixScrollArea.Root>
  );
}
