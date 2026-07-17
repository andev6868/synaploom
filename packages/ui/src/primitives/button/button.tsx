import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { classes } from '#ui/lib/classes';

const buttonVariants = cva('syn-button', {
  variants: {
    variant: {
      primary: 'syn-button--primary',
      secondary: 'syn-button--secondary',
      ghost: 'syn-button--ghost',
      danger: 'syn-button--danger',
    },
    size: {
      sm: 'syn-button--sm',
      md: 'syn-button--md',
      lg: 'syn-button--lg',
    },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});

/** Public properties for the Synaploom button primitive. */
export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  readonly asChild?: boolean;
  readonly loading?: boolean;
  readonly leadingIcon?: ReactNode;
}

/**
 * Renders the canonical actionable control used by Synaploom features.
 *
 * Loading state is announced through `aria-busy` and disables repeat actions.
 */
export function Button({
  asChild = false,
  children,
  className,
  disabled,
  leadingIcon,
  loading = false,
  size,
  type = 'button',
  variant,
  ...props
}: ButtonProps): ReactNode {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      aria-busy={loading || undefined}
      className={classes(buttonVariants({ variant, size }), className)}
      disabled={asChild ? undefined : loading ? true : disabled}
      type={asChild ? undefined : type}
      {...props}
    >
      {leadingIcon ? (
        <span aria-hidden="true" className="syn-button__icon">
          {leadingIcon}
        </span>
      ) : null}
      <span>{loading ? 'Đang xử lý…' : children}</span>
    </Component>
  );
}
