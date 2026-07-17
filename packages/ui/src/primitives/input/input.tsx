import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { classes } from '#ui/lib/classes';

/** Public properties for the accessible Synaploom text input. */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly label: string;
  readonly description?: string;
  readonly error?: string;
}

/** Renders a labelled input with stable help and error associations. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, description, error, id, label, ...props },
  ref,
): ReactNode {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <label className="syn-field" htmlFor={inputId}>
      <span className="syn-field__label">{label}</span>
      <input
        ref={ref}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={classes('syn-input', className)}
        id={inputId}
        {...props}
      />
      {description ? (
        <span className="syn-field__description" id={descriptionId}>
          {description}
        </span>
      ) : null}
      {error ? (
        <span className="syn-field__error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
});
