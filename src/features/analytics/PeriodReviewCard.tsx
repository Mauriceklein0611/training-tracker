import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, Stat } from '@/components/ui/Card';
import type { PeriodReview } from '@/services/periodReview';
import { formatCardioDistance } from '@/services/cardioMetrics';
import { formatNumber, formatVolume } from '@/utils/format';

/** Signed percentage, e.g. "+12 %" / "−4 %"; empty when not comparable. */
function deltaValue(percent: number | null): string | undefined {
  if (percent == null) return undefined;
  const sign = percent > 0 ? '+' : percent < 0 ? '−' : '±';
  return `${sign}${Math.abs(percent)}`;
}

/**
 * A compact local "wrapped" for the selected range: the headline figures and,
 * where comparable, how they moved against the equally long period before. All
 * derived from local data — no delta is shown when the previous period was empty.
 */
export function PeriodReviewCard({ review }: { review: PeriodReview }) {
  const { t } = useTranslation('analytics');
  const deltaText = (percent: number | null) => {
    const value = deltaValue(percent);
    return value == null ? undefined : t('review.previousPeriod', { value });
  };
  if (review.sessions === 0) return null;
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Sparkles size={18} aria-hidden="true" className="text-accent" />
            {t('review.title')}
          </span>
        }
        subtitle={t('review.subtitle')}
        as="h3"
      />
      <div className="grid grid-cols-2 gap-2">
        <Stat
          label={t('review.sessions')}
          value={formatNumber(review.sessions)}
          hint={deltaText(review.sessionsDeltaPercent)}
          tone="accent"
        />
        <Stat
          label={t('review.activeMinutes')}
          value={`${formatNumber(review.activeMinutes)} min`}
        />
        <Stat
          label={t('review.volume')}
          value={formatVolume(review.volumeKg)}
          hint={deltaText(review.volumeDeltaPercent)}
        />
        {review.cardioMinutes > 0 ? (
          <Stat
            label={t('review.cardio')}
            value={`${formatNumber(review.cardioMinutes)} min`}
            hint={
              review.cardioDistanceMeters > 0
                ? formatCardioDistance(review.cardioDistanceMeters, undefined)
                : undefined
            }
          />
        ) : null}
      </div>
      {review.topMuscleGroups.length > 0 ? (
        <p className="mt-2 text-sm text-muted">
          {t('review.topMuscles', { names: review.topMuscleGroups.join(', ') })}
        </p>
      ) : null}
    </Card>
  );
}
