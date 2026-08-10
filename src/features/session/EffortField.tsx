import { cn } from '@/utils/cn';
import { InfoHint } from '@/components/ui/InfoHint';
import {
  RIR_CHIP_VALUES,
  RPE_CHIP_VALUES,
  approxRirFromRpe,
  approxRpeFromRir,
  formatEffort,
} from '@/services/effort';
import { useTranslation } from 'react-i18next';

/**
 * Effort entry as tappable chips — RPE or RIR, per the user's setting. Only the
 * chosen metric is stored as the raw value; the other is shown underneath as a
 * clearly-labelled approximation, never persisted as a second measurement.
 * Effort is always optional: a chip can be tapped again to clear it.
 */
export function EffortField({
  mode,
  rir,
  rpe,
  onChange,
  expertLabels = false,
}: {
  mode: 'rpe' | 'rir';
  rir: string;
  rpe: string;
  onChange: (next: { rir: string; rpe: string }) => void;
  /** Compact term labels ("RPE") instead of the spelled-out beginner ones. */
  expertLabels?: boolean;
}) {
  const { t } = useTranslation('session');
  const rpeMode = mode === 'rpe';
  const raw = rpeMode ? rpe : rir;
  const selected = raw === '' ? null : Number(raw);

  const pick = (value: number) => {
    // Tapping the active chip clears it; a new pick replaces and clears the other
    // metric so only the entered value is ever stored.
    const isActive =
      selected != null &&
      (rpeMode
        ? selected === value
        : // The last RIR chip means "4 or more".
          value === 4
          ? selected >= 4
          : selected === value);
    if (isActive) {
      onChange({ rir: '', rpe: '' });
    } else if (rpeMode) {
      onChange({ rpe: String(value), rir: '' });
    } else {
      onChange({ rir: String(value), rpe: '' });
    }
  };

  const values = rpeMode ? RPE_CHIP_VALUES : RIR_CHIP_VALUES;
  const label = expertLabels
    ? rpeMode
      ? 'RPE'
      : 'RIR'
    : rpeMode
      ? t('effort.exertion')
      : t('effort.repsInReserve');

  const approx =
    selected == null
      ? null
      : rpeMode
        ? `≈ ${formatEffort(approxRirFromRpe(selected))} RIR`
        : `≈ RPE ${formatEffort(approxRpeFromRir(selected))}`;

  return (
    <div className="min-w-0 sm:col-span-2">
      <span className="mb-1 flex items-center gap-1 text-sm font-medium text-muted">
        <span>
          {label} <span className="font-normal">({t('effort.optional')})</span>
        </span>
        <InfoHint term={rpeMode ? 'rpe' : 'rir'} />
      </span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {values.map((value) => {
          const isActive =
            selected != null &&
            (rpeMode
              ? selected === value
              : value === 4
                ? selected >= 4
                : selected === value);
          const chipLabel = !rpeMode && value === 4 ? '4+' : formatEffort(value);
          return (
            <button
              key={value}
              type="button"
              aria-pressed={isActive}
              onClick={() => pick(value)}
              className={cn(
                'min-h-[44px] min-w-[44px] rounded-xl border px-3 text-sm font-medium',
                isActive
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border bg-surface-2 text-text active:bg-surface-3',
              )}
            >
              {chipLabel}
            </button>
          );
        })}
      </div>
      {approx ? (
        <p className="mt-1 text-xs text-muted">
          {approx} · {t('effort.approximation')}
        </p>
      ) : null}
    </div>
  );
}
