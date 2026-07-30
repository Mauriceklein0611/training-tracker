import { Lightbulb } from 'lucide-react';
import type { ProgressionSuggestion } from '@/services/progression';
import { formatKg, formatNumber } from '@/utils/format';
import { useTranslation } from 'react-i18next';

/**
 * Shows the local progression suggestion for an exercise.
 *
 * Deliberately styled as advice, not as data: dashed border, a lamp icon and an
 * explicit "Empfehlung" label keep it visually separate from the recorded sets
 * above it. Nothing here is applied automatically — the user decides.
 */
export function ProgressionHint({ suggestion }: { suggestion: ProgressionSuggestion }) {
  const { t } = useTranslation('session');
  const { t: tCommon } = useTranslation('common');
  const values: string[] = [];
  if (suggestion.suggestedWeightKg != null) {
    values.push(formatKg(suggestion.suggestedWeightKg));
  }
  if (suggestion.suggestedReps != null) {
    values.push(`${formatNumber(suggestion.suggestedReps)} ${tCommon('units.reps')}`);
  }
  const display = suggestion.display;
  const params = display?.params ?? {};
  const rirNote =
    params.rir === ''
      ? t('progression.rirMissing')
      : params.rir != null
        ? t('progression.rirRecorded', { value: params.rir })
        : '';
  const headline = display
    ? t(`progression.advice.headline.${display.headline}`)
    : suggestion.headline;
  const reason = display
    ? t(`progression.advice.reason.${display.reason}`, { ...params, rirNote })
    : suggestion.reason;

  return (
    <section
      aria-label={t('progression.aria')}
      className="mt-3 rounded-xl border border-dashed border-border bg-surface-2 p-3"
    >
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <Lightbulb size={14} aria-hidden="true" />
        {t('progression.title')}
      </p>

      <p className="mt-1 text-sm font-medium">{headline}</p>

      {values.length > 0 ? (
        <p className="numeric mt-0.5 text-sm text-accent">
          {t('progression.suggestion', { value: values.join(' × ') })}
        </p>
      ) : null}

      <p className="mt-1.5 text-xs leading-relaxed text-muted">{reason}</p>

      <p className="mt-1.5 text-xs text-muted">{t('progression.disclaimer')}</p>
    </section>
  );
}
