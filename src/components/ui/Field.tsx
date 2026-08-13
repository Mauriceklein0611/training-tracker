import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { useTranslation } from 'react-i18next';
import { combineDuration, parseClockDuration, splitDuration } from '@/services/duration';
import { parseNumberInput } from '@/services/validation';
import { formatDuration } from '@/utils/date';
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

export interface NumberValueFieldProps extends Omit<
  NumberFieldProps,
  'value' | 'defaultValue' | 'onChange'
> {
  /** Current value, or undefined for an empty field. */
  value: number | undefined;
  /** Called with the parsed value; undefined once the field is left empty. */
  onValueChange: (value: number | undefined) => void;
  /** Lowest accepted value. Typing below it is allowed but only applied on blur. */
  min?: number;
  /** Highest accepted value, applied the same way as {@link min}. */
  max?: number;
  /**
   * Whether the field must end up carrying a value. A required field that is
   * left empty falls back to the last value it had (nothing is invented), an
   * optional one reports `undefined`.
   */
  required?: boolean;
}

/**
 * Numeric field that owns the text the user types.
 *
 * The naive pattern — a controlled `NumberField` whose parent clamps every
 * keystroke — makes a value impossible to correct: deleting the "3" of a set
 * goal produced an empty string, the parent turned that into its fallback "1",
 * and the re-rendered field showed a "1" that could not be deleted either, so
 * only 1x remained reachable. Here the *field* keeps the raw text (empty stays
 * empty while typing) and the parent only ever sees numbers:
 *
 * - a value outside [min, max] is not reported while typing (so a leading "0"
 *   of "05" never becomes a stored 0), and is clamped once on blur;
 * - a required field left empty is restored to its previous value on blur;
 * - a value changed from outside (a reset, another editor) is adopted.
 */
export const NumberValueField = forwardRef<HTMLInputElement, NumberValueFieldProps>(
  function NumberValueField(
    { value, onValueChange, min, max, required = false, decimal = false, ...props },
    ref,
  ) {
    const [draft, setDraft] = useState(() => (value == null ? '' : String(value)));
    // The last value this field reported; anything else arriving in `value` is
    // an outside change and replaces the draft.
    const lastEmitted = useRef<number | undefined>(value);

    useEffect(() => {
      if (value !== lastEmitted.current) {
        lastEmitted.current = value;
        setDraft(value == null ? '' : String(value));
      }
    }, [value]);

    const emit = (next: number | undefined) => {
      lastEmitted.current = next;
      onValueChange(next);
    };

    const normalize = (raw: number): number => {
      const rounded = decimal ? raw : Math.round(raw);
      const lower = min != null ? Math.max(min, rounded) : rounded;
      return max != null ? Math.min(max, lower) : lower;
    };

    const handleChange = (raw: string) => {
      setDraft(raw);
      if (raw.trim() === '') {
        if (!required) emit(undefined);
        return;
      }
      const parsed = parseNumberInput(raw);
      if (parsed == null || Number.isNaN(parsed)) return;
      // Out-of-range input is kept visible but not reported, so an intermediate
      // "0" while typing "05" never reaches the database.
      if (parsed !== normalize(parsed)) return;
      emit(parsed);
    };

    const handleBlur = () => {
      if (draft.trim() === '') {
        // A required field keeps what it had — clearing it is not an edit.
        setDraft(required && value != null ? String(value) : '');
        return;
      }
      const parsed = parseNumberInput(draft);
      if (parsed == null || Number.isNaN(parsed)) {
        setDraft(value == null ? '' : String(value));
        return;
      }
      const normalized = normalize(parsed);
      setDraft(String(normalized));
      if (normalized !== value) emit(normalized);
    };

    return (
      <NumberField
        ref={ref}
        decimal={decimal}
        value={draft}
        onChange={(event) => handleChange(event.target.value)}
        {...props}
        onBlur={(event) => {
          handleBlur();
          props.onBlur?.(event);
        }}
      />
    );
  },
);

/**
 * Duration entry as hours / minutes / seconds.
 *
 * A cardio duration is entered the way it is read — 1 h 20 min 30 s — instead of
 * as a raw number of seconds, which nobody computes on the way out of the gym.
 * Three separate boxes rather than one "1:20:30" text field on purpose: the
 * numeric keypad of a phone has no colon. A colon-style value pasted or typed
 * into any box is still understood ({@link parseClockDuration}).
 *
 * The stored value stays whole seconds — this is an entry format, not a data
 * change.
 */
export function DurationField({
  label,
  value,
  onValueChange,
  withHours = true,
  hint,
  error,
  containerClassName,
  disabled,
  onCommit,
}: {
  label: string;
  /** Current duration in seconds, or undefined for an empty field. */
  value: number | undefined;
  onValueChange: (seconds: number | undefined) => void;
  /** Offer an hours box. Off for short holds, where minutes/seconds are enough. */
  withHours?: boolean;
  hint?: ReactNode;
  error?: string;
  containerClassName?: string;
  disabled?: boolean;
  /** Called when the field is left, for callers that persist on blur. */
  onCommit?: () => void;
}) {
  const { t } = useTranslation('common');
  const id = useId();

  const toDraft = (seconds: number | undefined) => {
    if (seconds == null) return { hours: '', minutes: '', seconds: '' };
    const total = Math.max(0, Math.round(seconds));
    if (!withHours) {
      const minutes = Math.floor(total / 60);
      return {
        hours: '',
        minutes: minutes > 0 ? String(minutes) : '',
        seconds: String(total % 60),
      };
    }
    const parts = splitDuration(total);
    return {
      hours: parts.hours > 0 ? String(parts.hours) : '',
      minutes: parts.hours > 0 || parts.minutes > 0 ? String(parts.minutes) : '',
      seconds: String(parts.seconds),
    };
  };

  const [draft, setDraft] = useState(() => toDraft(value));
  const lastEmitted = useRef<number | undefined>(value);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setDraft(toDraft(value));
    }
    // toDraft only depends on withHours, which never changes for a mounted field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, withHours]);

  const emit = (next: number | undefined) => {
    lastEmitted.current = next;
    onValueChange(next);
  };

  const totalOf = (parts: { hours: string; minutes: string; seconds: string }) => {
    if (parts.hours === '' && parts.minutes === '' && parts.seconds === '') {
      return undefined;
    }
    return combineDuration({
      hours: Number(parts.hours || 0),
      minutes: Number(parts.minutes || 0),
      seconds: Number(parts.seconds || 0),
    });
  };

  const handleChange = (key: 'hours' | 'minutes' | 'seconds', raw: string) => {
    // "1:20:30" typed or pasted into any box means the whole duration.
    const clock = parseClockDuration(raw);
    if (clock != null) {
      setDraft(toDraft(clock));
      emit(clock);
      return;
    }
    const digits = raw.replace(/[^0-9]/g, '').slice(0, 5);
    const next = { ...draft, [key]: digits };
    setDraft(next);
    emit(totalOf(next));
  };

  const handleBlur = () => {
    // Carry an entered "90 s" over into 1 min 30 s, so the field always reads
    // back the way the duration is spoken.
    const total = totalOf(draft);
    setDraft(toDraft(total));
    onCommit?.();
  };

  const total = totalOf(draft);
  const boxes = (
    [
      { key: 'hours', unit: t('duration.hoursShort'), name: t('duration.hours') },
      { key: 'minutes', unit: t('duration.minutesShort'), name: t('duration.minutes') },
      { key: 'seconds', unit: t('duration.secondsShort'), name: t('duration.seconds') },
    ] as const
  ).filter((box) => withHours || box.key !== 'hours');

  return (
    <fieldset className={cn('flex min-w-0 flex-col gap-1.5', containerClassName)}>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="flex min-w-0 items-center gap-2">
        {boxes.map((box) => (
          <div key={box.key} className="flex min-w-0 flex-1 items-center gap-1">
            <input
              id={`${id}-${box.key}`}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={disabled}
              aria-label={`${label} – ${box.name}`}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
              placeholder="0"
              value={draft[box.key]}
              onChange={(event) => handleChange(box.key, event.target.value)}
              onBlur={handleBlur}
              className={cn(
                CONTROL,
                'numeric px-2 text-center text-lg',
                error && CONTROL_INVALID,
              )}
            />
            <span aria-hidden="true" className="shrink-0 text-sm text-muted">
              {box.unit}
            </span>
          </div>
        ))}
      </div>
      {total != null && total > 0 && !error ? (
        <p className="numeric text-xs text-muted">
          {t('duration.total', { value: formatDuration(total) })}
        </p>
      ) : null}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs leading-relaxed text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger">
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

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
        'flex w-full min-w-0 flex-wrap gap-1 rounded-xl border border-border bg-surface-2 p-1',
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
              'min-h-[40px] min-w-[min(100%,8rem)] flex-1 whitespace-normal break-words rounded-lg px-3 text-sm font-medium transition-colors',
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
