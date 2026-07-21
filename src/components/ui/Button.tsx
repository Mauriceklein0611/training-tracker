import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-contrast font-semibold active:bg-accent-strong',
  secondary: 'bg-surface-2 text-text border border-border active:bg-surface-3',
  ghost: 'bg-transparent text-text active:bg-surface-2',
  danger: 'bg-danger text-danger-contrast font-semibold active:opacity-90',
  success: 'bg-success text-accent-contrast font-semibold active:opacity-90',
};

const SIZES: Record<Size, string> = {
  // Every size keeps the 44px minimum touch target.
  sm: 'min-h-[44px] px-3 text-sm rounded-xl',
  md: 'min-h-[48px] px-4 text-base rounded-xl',
  lg: 'min-h-[56px] px-5 text-lg rounded-2xl',
};

/**
 * The single button implementation used across the app.
 * `type` defaults to "button" so a button inside a form never submits by accident.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', fullWidth, className, type, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn(
        'inline-flex items-center justify-center gap-2 transition-colors',
        'disabled:opacity-45 disabled:pointer-events-none select-none',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    />
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only controls need an accessible name. */
  label: string;
  variant?: Variant;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = 'ghost', className, type, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-xl touch-target transition-colors',
        'disabled:opacity-40 disabled:pointer-events-none',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
