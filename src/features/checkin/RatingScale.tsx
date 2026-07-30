import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';

/**
 * A compact 1–5 (or 0–5) self-rating as a radio group.
 *
 * Optional by design: a "–" button clears the value, and no rating is ever
 * required. Values are plain subjective numbers, never combined into a score.
 */
export function RatingScale({
  label,
  hint,
  value,
  min = 1,
  max = 5,
  lowLabel,
  highLabel,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number | undefined;
  min?: number;
  max?: number;
  lowLabel?: string;
  highLabel?: string;
  onChange: (value: number | undefined) => void;
}) {
  const { t } = useTranslation('more');
  const values = Array.from({ length: max - min + 1 }, (_, index) => min + index);

  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className={cn(
            'min-h-[32px] rounded-lg px-2 text-xs font-medium',
            value == null ? 'text-muted' : 'text-accent',
          )}
        >
          {value == null ? t('screens.checkIn.noValue') : t('screens.checkIn.reset')}
        </button>
      </div>
      <div role="radiogroup" aria-label={label} className="flex gap-1.5">
        {values.map((option) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(selected ? undefined : option)}
              className={cn(
                'numeric h-11 flex-1 rounded-xl border text-base font-semibold transition-colors',
                selected
                  ? 'border-accent bg-accent text-accent-contrast'
                  : 'border-border bg-surface-2 text-text active:bg-surface-3',
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
      {lowLabel || highLabel ? (
        <div className="flex justify-between text-[11px] text-muted">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      ) : null}
      {hint ? <p className="text-xs leading-relaxed text-muted">{hint}</p> : null}
    </div>
  );
}
