import { Activity, Trophy } from 'lucide-react';
import { Stat } from '@/components/ui/Card';
import type { SessionSummary } from '@/services/sessionSummary';
import {
  formatCardioDistance,
  formatDuration as formatCardioDuration,
  formatPace,
} from '@/services/cardioMetrics';
import { formatDate, formatDurationLong } from '@/utils/date';
import {
  formatKg,
  formatNumber,
  formatPercent,
  formatSets,
  formatSignedSeconds,
  formatVolume,
} from '@/utils/format';
import { useTranslation } from 'react-i18next';

/** Shared summary block, used both when finishing and when reviewing a workout. */
export function SessionSummaryView({ summary }: { summary: SessionSummary }) {
  const { t } = useTranslation('session');
  const { t: tCommon } = useTranslation('common');
  const { t: tDomain } = useTranslation('domain');
  const { restStatistics: rest } = summary;
  // A pure-cardio session leads with cardio; the strength grid (which would be
  // all zeros and dashes) is suppressed so it never dominates before Dauer,
  // Distanz, Pace and the cardio figures.
  const cardioOnly = summary.hasCardio && !summary.hasStrength;

  const duration =
    summary.durationSeconds == null ? '–' : formatDurationLong(summary.durationSeconds);

  // Comparison to the last comparable session — only shown when a delta exists.
  const prev = summary.previousComparable;
  const comparisonDelta =
    prev?.volumeDeltaPercent != null
      ? { value: prev.volumeDeltaPercent, unit: t('summary.volumeComparison') }
      : prev?.cardioDurationDeltaPercent != null
        ? {
            value: prev.cardioDurationDeltaPercent,
            unit: t('summary.cardioDurationComparison'),
          }
        : null;

  // Estimated energy — deliberately labelled as an estimate, since it is
  // modelled from body weight and recorded time, not measured.
  const caloriesStat = summary.calories ? (
    <Stat
      label={t('summary.caloriesEstimated')}
      value={`≈ ${formatNumber(summary.calories.kcal)} kcal`}
      hint={t('summary.caloriesEstimatedHint')}
    />
  ) : null;

  const cardioBlock = summary.hasCardio ? (
    <div className="rounded-2xl border border-cardio/40 bg-surface p-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Activity size={18} aria-hidden="true" className="text-cardio" />
        {t('summary.cardio')}
      </h3>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Stat
          label={t('summary.activities')}
          value={formatNumber(summary.cardio.activities)}
        />
        <Stat
          label={t('summary.cardioDuration')}
          value={formatCardioDuration(summary.cardio.totalDurationSeconds)}
        />
        {summary.cardio.totalDistanceMeters > 0 ? (
          <Stat
            label={t('summary.distance')}
            value={formatCardioDistance(
              summary.cardio.totalDistanceMeters,
              summary.cardioModality,
            )}
          />
        ) : null}
        {summary.cardioPace ? (
          <Stat label={t('summary.pace')} value={formatPace(summary.cardioPace)} />
        ) : null}
        {summary.cardioAvgRpe != null ? (
          <Stat
            label={t('summary.averageRpe')}
            value={formatNumber(summary.cardioAvgRpe, 1)}
          />
        ) : null}
        {summary.cardio.averageHeartRateBpm != null ? (
          <Stat
            label={t('summary.averageHeartRate')}
            value={`${Math.round(summary.cardio.averageHeartRateBpm)} bpm`}
            hint={t('summary.recorded')}
          />
        ) : null}
        {summary.cardio.totalCaloriesKcal > 0 ? (
          <Stat
            label={t('summary.calories')}
            value={`${formatNumber(summary.cardio.totalCaloriesKcal)} kcal`}
            hint={t('summary.captured')}
          />
        ) : null}
        {summary.cardio.totalElevationGainMeters > 0 ? (
          <Stat
            label={t('summary.elevation')}
            value={`${formatNumber(summary.cardio.totalElevationGainMeters)} m`}
          />
        ) : null}
      </div>
    </div>
  ) : null;

  // A first-ever value is a baseline, not an improvement: only real records
  // (with something to beat) are celebrated; baselines get a calm note.
  const realRecords = summary.newRecords.filter((record) => record.previousValue != null);
  const baselineNames = [
    ...new Set(
      summary.newRecords
        .filter((record) => record.previousValue == null)
        .map((record) => record.exerciseName),
    ),
  ];

  return (
    <div className="grid gap-3">
      {realRecords.length > 0 ? (
        <div className="celebrate overflow-hidden rounded-2xl border border-success/50 bg-surface p-4">
          <div className="celebrate-sheen">
            <p className="flex items-center gap-2 text-base font-semibold text-success">
              <Trophy size={20} aria-hidden="true" />
              {realRecords.length === 1
                ? t('summary.newRecordOne')
                : t('summary.newRecordOther', { value: realRecords.length })}
            </p>
            <p className="mt-0.5 text-sm text-muted">{t('summary.strongSession')}</p>
          </div>
        </div>
      ) : null}

      {comparisonDelta ? (
        <div
          className={
            comparisonDelta.value >= 0
              ? 'rounded-2xl border border-success/40 bg-surface p-3 text-sm'
              : 'rounded-2xl border border-border bg-surface p-3 text-sm'
          }
        >
          <span
            className={
              comparisonDelta.value >= 0
                ? 'numeric font-semibold text-success'
                : 'numeric font-semibold text-warning'
            }
          >
            {comparisonDelta.value >= 0 ? '+' : '−'}
            {formatNumber(Math.abs(comparisonDelta.value), 0)} % {comparisonDelta.unit}
          </span>{' '}
          <span className="text-muted">
            {t('summary.versusPrevious', {
              date: prev ? ` (${formatDate(prev.startedAt)})` : '',
            })}
          </span>
        </div>
      ) : null}

      {cardioOnly ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat label={t('summary.duration')} value={duration} tone="accent" />
            <Stat
              label={t('summary.exercises')}
              value={formatNumber(summary.exerciseCount)}
            />
            {caloriesStat}
          </div>
          {cardioBlock}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat label={t('summary.duration')} value={duration} tone="accent" />
            <Stat
              label={t('summary.exercises')}
              value={formatNumber(summary.exerciseCount)}
            />
            <Stat
              label={t('summary.workingSets')}
              value={formatNumber(summary.workingSetCount)}
            />
            <Stat
              label={t('summary.repetitions')}
              value={formatNumber(summary.totalReps)}
            />
            <Stat
              label={t('summary.volume')}
              value={formatVolume(summary.volume.volumeKg)}
              hint={t('summary.volumeOnlyWeighted')}
            />
            <Stat
              label={t('summary.averageRestDeviation')}
              value={formatSignedSeconds(rest.averageDeviationSeconds)}
              hint={
                rest.evaluatedSets > 0
                  ? t('summary.restTargetMet', {
                      value: formatPercent(rest.targetMetRatio),
                    })
                  : t('summary.noRestRecorded')
              }
            />
            {caloriesStat}
          </div>

          {summary.volume.addedWeightVolumeKg > 0 ? (
            <p className="text-xs text-muted">
              {t('summary.addedWeightVolume', {
                value: formatKg(summary.volume.addedWeightVolumeKg),
              })}
            </p>
          ) : null}

          {summary.volume.setsWithoutVolume > 0 ? (
            <p className="text-xs text-muted">
              {t('summary.setsWithoutVolume', {
                value: formatSets(summary.volume.setsWithoutVolume),
              })}
            </p>
          ) : null}

          {cardioBlock}
        </>
      )}

      {baselineNames.length > 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-3">
          <h3 className="text-sm font-semibold">{t('summary.baselineTitle')}</h3>
          <p className="mt-0.5 text-sm text-muted">
            {t('summary.baselineDescription', { names: baselineNames.join(', ') })}
          </p>
        </div>
      ) : null}

      {realRecords.length > 0 ? (
        <div className="rounded-2xl border border-success/50 bg-surface p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-success">
            <Trophy size={18} aria-hidden="true" />
            {t('summary.newRecords')}
          </h3>
          <ul className="mt-2 grid gap-1.5">
            {realRecords.map((record) => (
              <li
                key={`${record.exerciseId} ${record.equipment} ${record.weightMode} ${record.kind}`}
                className="text-sm"
              >
                <span className="font-medium">{record.exerciseName}</span>
                {record.equipment !== 'unspecified' ? (
                  <span className="text-muted">
                    {' '}
                    · {tDomain(`equipment.${record.equipment}`)}
                  </span>
                ) : null}
                <span className="text-muted"> — {record.label}: </span>
                <span className="numeric font-semibold">
                  {record.kind === 'reps'
                    ? `${formatNumber(record.value)} ${tCommon('units.reps')}`
                    : record.kind === 'duration'
                      ? `${formatNumber(record.value)} s`
                      : formatKg(record.value)}
                </span>
                {record.previousValue != null ? (
                  <span className="text-xs text-muted">
                    {' '}
                    (
                    {t('summary.previous', {
                      value:
                        record.kind === 'reps'
                          ? formatNumber(record.previousValue)
                          : record.kind === 'duration'
                            ? `${formatNumber(record.previousValue)} s`
                            : formatKg(record.previousValue),
                    })}
                    )
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
