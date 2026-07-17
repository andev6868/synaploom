import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

/** Public properties for a modal dialog owned by the design system. */
export interface DialogProps {
  readonly trigger: ReactElement;
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
}

/** Renders a focus-managed modal with explicit title and dismiss control. */
export function Dialog({ children, description, title, trigger }: DialogProps): ReactNode {
  return (
    <RadixDialog.Root>
      <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="syn-dialog__overlay" />
        <RadixDialog.Content className="syn-dialog__content">
          <RadixDialog.Title className="syn-dialog__title">{title}</RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className="syn-dialog__description">
              {description}
            </RadixDialog.Description>
          ) : null}
          {children}
          <RadixDialog.Close aria-label="Đóng" className="syn-dialog__close">
            <X aria-hidden="true" size={18} />
          </RadixDialog.Close>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
