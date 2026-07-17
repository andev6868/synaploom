import * as RadixSeparator from '@radix-ui/react-separator';
import type { ComponentProps, ReactNode } from 'react';
import { classes } from '#ui/lib/classes';

/** A semantic separator using Synaploom visual tokens. */
export function Separator({
  className,
  ...props
}: ComponentProps<typeof RadixSeparator.Root>): ReactNode {
  return <RadixSeparator.Root className={classes('syn-separator', className)} {...props} />;
}
