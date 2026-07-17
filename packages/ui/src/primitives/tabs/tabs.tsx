import * as RadixTabs from '@radix-ui/react-tabs';
import type { ComponentProps, ReactNode } from 'react';
import { classes } from '#ui/lib/classes';

/** Accessible tabs root. */
export function Tabs(props: ComponentProps<typeof RadixTabs.Root>): ReactNode {
  return <RadixTabs.Root {...props} />;
}

/** Accessible tabs list. */
export function TabsList({
  className,
  ...props
}: ComponentProps<typeof RadixTabs.List>): ReactNode {
  return <RadixTabs.List className={classes('syn-tabs__list', className)} {...props} />;
}

/** Accessible tabs trigger. */
export function TabsTrigger({
  className,
  ...props
}: ComponentProps<typeof RadixTabs.Trigger>): ReactNode {
  return <RadixTabs.Trigger className={classes('syn-tabs__trigger', className)} {...props} />;
}

/** Accessible tabs panel. */
export function TabsContent({
  className,
  ...props
}: ComponentProps<typeof RadixTabs.Content>): ReactNode {
  return <RadixTabs.Content className={classes('syn-tabs__content', className)} {...props} />;
}
