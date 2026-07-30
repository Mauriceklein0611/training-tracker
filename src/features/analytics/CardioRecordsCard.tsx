import type { CardioModality } from '@/types';
import { useTranslation } from 'react-i18next';
import {
  formatCardioDistance,
  formatPace,
  type CardioRecords,
} from '@/services/cardioMetrics';
import { formatDurationLong } from '@/utils/date';

/**
 * Cardio personal bests for one exercise. Only bests that actually exist are
 * shown; nothing is invented. These are records within a single exercise (one
 * modality), so a short run is never weighed against a long ride, and the pace
 * best is labelled as the fastest *recorded* pace — never a fitness claim.
 */
export function CardioRecordsCard({
  modality,
  records,
}: {
  modality: CardioModality | undefined;
  records: CardioRecords;
}) {
  const { t } = useTranslation('analytics');
  const rows: { label: string; value: string }[] = [];
  if (records.longestDurationSeconds != null) {
    rows.push({
      label: t('cardioRecords.longestDuration'),
      value: formatDurationLong(records.longestDurationSeconds),
    });
  }
  if (records.greatestDistanceMeters != null) {
    rows.push({
      label: t('cardioRecords.greatestDistance'),
      value: formatCardioDistance(records.greatestDistanceMeters, modality),
    });
  }
  if (records.bestPace != null) {
    rows.push({
      label: t('cardioRecords.fastestPace'),
      value: formatPace(records.bestPace),
    });
  }

  if (rows.length === 0) return null;

  return (
    <section
      aria-label={t('cardioRecords.aria')}
      className="mt-3 rounded-2xl border border-cardio/40 bg-surface p-3"
    >
      <h4 className="text-sm font-semibold text-cardio">{t('cardioRecords.title')}</h4>
      <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label} className="rounded-xl border border-border px-3 py-2">
            <dt className="text-xs text-muted">{row.label}</dt>
            <dd className="numeric mt-0.5 text-base font-semibold">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        {t('cardioRecords.explanation')}
      </p>
    </section>
  );
}
