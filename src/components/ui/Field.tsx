import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/utils/cn';

const CONTROL =
  'w-full rounded-xl border border-border bg-surface-2 px-3 py-3 min-h-[48px] ' +
  'placeholder:text-muted/70 transition-colors focus:border-accent';

const CONTROL_INVALID = 'border-danger';

function FieldShell({
  id,
  label,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs leading-relaxed text-muted">
          {hint}
        </p>
      ) : null}
      {/*
       * Errors are announced and marked with a symbol as well as colour, so the
       * message never relies on colour alone.
       */}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger">
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id'
> {
  label: string;
  hint?: ReactNode;
  error?: string;
  containerClassName?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, containerClassName, className, ...props },
  ref,
) {
  const id = useId();
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      className={containerClassName}
    >
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(CONTROL, error && CONTROL_INVALID, className)}
        {...props}
      />
    </FieldShell>
  );
});

export interface NumberFieldProps extends Omit<TextFieldProps, 'type' | 'inputMode'> {
  /** Allow decimals (weights) or restrict to integers (repetitions). */
  decimal?: boolean;
}

/**
 * Numeric input for the live view.
 *
 * Uses `type="text"` with `inputMode="decimal"` rather than `type="number"`:
 * it brings up the numeric keypad on iOS without the spinner buttons, avoids
 * accidental value changes when scrolling, and lets us accept a comma as
 * decimal separator.
 */
export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(
  function NumberField({ decimal = false, className, ...props }, ref) {
    return (
      <TextField
        ref={ref}
        type="text"
        inputMode={decimal ? 'decimal' : 'numeric'}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        pattern={decimal ? '[0-9]*[.,]?[0-9]*' : '[0-9]*'}
        className={cn('numeric text-lg', className)}
        {...props}
      />
    );
  },
);

export interface SelectFieldProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'id'
> {
  label: string;
  hint?: ReactNode;
  error?: string;
  containerClassName?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  function SelectField(
    { label, hint, error, containerClassName, className, children, ...props },
    ref,
  ) {
    const id = useId();
    return (
      <FieldShell
        id={id}
        label={label}
        hint={hint}
        error={error}
        className={containerClassName}
      >
        <select
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cn(
            CONTROL,
            'appearance-none pr-8',
            error && CONTROL_INVALID,
            className,
          )}
          {...props}
        >
          {children}
        </select>
      </FieldShell>
    );
  },
);

export interface TextAreaFieldProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'id'
> {
  label: string;
  hint?: ReactNode;
  error?: string;
  containerClassName?: string;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  function TextAreaField(
    { label, hint, error, containerClassName, className, ...props },
    ref,
  ) {
    const id = useId();
    return (
      <FieldShell
        id={id}
        label={label}
        hint={hint}
        error={error}
        className={containerClassName}
      >
        <textarea
          ref={ref}
          id={id}
          rows={3}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cn(CONTROL, 'resize-y', error && CONTROL_INVALID, className)}
          {...props}
        />
      </FieldShell>
    );
  },
);

export function CheckboxField({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="mt-1 h-6 w-6 shrink-0 accent-[var(--accent)]"
      />
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium">
          {label}
        </label>
        {hint ? (
          <p id={`${id}-hint`} className="mt-0.5 text-xs leading-relaxed text-muted">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Compact single-choice control, rendered as a radio group so screen readers
 * and the keyboard treat it correctly.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'flex w-full gap-1 overflow-x-auto rounded-xl border border-border bg-surface-2 p-1',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-h-[40px] flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors',
              selected
                ? 'bg-accent text-accent-contrast'
                : 'text-muted active:bg-surface-3',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
