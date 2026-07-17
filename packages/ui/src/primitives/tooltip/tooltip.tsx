import * as RadixTooltip from '@radix-ui/react-tooltip';
import type { ReactElement, ReactNode } from 'react';

/** Public properties for a concise, accessible tooltip. */
export interface TooltipProps {
  readonly children: ReactElement;
  readonly content: ReactNode;
}

/** Adds hover and keyboard help without changing the child control. */
export function Tooltip({ children, content }: TooltipProps): ReactNode {
  return (
    <RadixTooltip.Provider delayDuration={350}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content className="syn-tooltip" sideOffset={8}>
            {content}
            <RadixTooltip.Arrow className="syn-tooltip__arrow" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
