import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, EmptyState, Stat } from '@/components/ui/Card';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { ChartFrame, DataTable, SimpleLineChart } from '@/features/analytics/Charts';
import { CardioRecordsCard } from '@/features/analytics/CardioRecordsCard';
import { AnatomyBodyMap } from '@/features/muscles/AnatomyBodyMap';
import { getExercise } from '@/db/repositories/exercises';
import { loadAnalyticsDataset } from '@/services/dataset';
import {
  computeExerciseCardioRecords,
  computeExerciseSeries,
} from '@/services/analytics';
import { summarizeExerciseHistory } from '@/services/exerciseHistory';
import { distinctExerciseVariants } from '@/services/exerciseVariants';
import {
  formatCardioDistance,
  formatDuration as formatCardioDuration,
  formatPace,
} from '@/services/cardioMetrics';
import { formatDate, formatDurationLong, lastDaysRange } from '@/utils/date';
import { formatKg, formatNumber, formatVolume } from '@/utils/format';
import { exerciseDisplayName } from '@/utils/exerciseDisplay';

/**
 * Exercise "story" page: the current record, the last performance, an eight-week
 * trend, the recent sessions, the muscles worked and any technique cues — a
 * single place that tells the exercise's history. Strength and cardio each show
 * the metrics that make sense for them; nothing is invented for the other kind.
 */
export default function ExerciseDetailPage() {
  const { t } = useTranslation('more');
  const { exerciseId = '' } = useParams();

  const data = useLiveQuery(async () => {
    const exercise = await getExercise(exerciseId);
    if (!exercise) return null;
    const dataset = await loadAnalyticsDataset();
    return {
      exercise,
      series: computeExerciseSeries(dataset, exerciseId, null),
      recent8w: computeExerciseSeries(dataset, exerciseId, lastDaysRange(56)),
      variants: distinctExerciseVariants(dataset, exerciseId),
      cardioRecords:
        exercise.trackingType === 'cardio'
          ? computeExerciseCardioRecords(dataset, exerciseId, null)
          : null,
    };
  }, [exerciseId]);

  const summary = useMemo(
    () => (data ? summarizeExerciseHistory(data.series) : null),
    [data],
  );

  const chartPoints = useMemo(
    () =>
      (data?.recent8w ?? [])
        .filter((point) => point.estimatedOneRepMax != null)
        .map((point) => ({
          label: formatDate(point.date).slice(0, 6),
          value: Math.round((point.estimatedOneRepMax ?? 0) * 10) / 10,
        })),
    [data?.recent8w],
  );

  if (data === undefined) {
    return (
      <>
        <PageHeader
          title={t('screens.exercise.detail.genericTitle')}
          backTo="/mehr/uebungen"
        />
        <div className="grid gap-3" aria-busy="true">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </>
    );
  }

  if (data === null) {
    return (
      <>
        <PageHeader
          title={t('screens.exercise.detail.genericTitle')}
          backTo="/mehr/uebungen"
        />
        <EmptyState
          title={t('screens.exercise.detail.notFoundTitle')}
          description={t('screens.exercise.detail.notFoundDescription')}
        />
      </>
    );
  }

  const { exercise } = data;
  const isCardio = exercise.trackingType === 'cardio';
  const hasHistory = (summary?.sessionCount ?? 0) > 0;

  return (
    <>
      <PageHeader title={exerciseDisplayName(exercise)} backTo="/mehr/uebungen" />
      <div className="grid gap-3">
        {!isCardio ? (
          <Card>
            <AnatomyBodyMap
              primary={exercise.primaryMuscleGroup ? [exercise.primaryMuscleGroup] : []}
              secondary={exercise.secondaryMuscleGroups}
            />
          </Card>
        ) : null}

        {exercise.techniqueCues && exercise.techniqueCues.length > 0 ? (
          <Card>
            <CardHeader title={t('screens.exercise.detail.technique')} as="h2" />
            <ul className="grid list-disc gap-1 pl-5 text-sm">
              {exercise.techniqueCues.map((cue, index) => (
                <li key={index}>{cue}</li>
              ))}
            </ul>
          </Card>
        ) : null}

        {data.variants.length > 0 || exercise.targetRir != null ? (
          <Card>
            <CardHeader title={t('screens.exercise.detail.executionAndGoal')} as="h2" />
            {data.variants.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {data.variants.map((variant) => (
                  <span
                    key={variant}
                    className="rounded-lg bg-surface-2 px-2 py-0.5 text-xs text-muted"
                  >
                    {variant}
                  </span>
                ))}
              </div>
            ) : null}
            {exercise.targetRir != null ? (
              <p className="mt-2 text-sm text-muted">
                {t('screens.exercise.detail.nextTarget', {
                  value: exercise.targetRir,
                })}
              </p>
            ) : null}
          </Card>
        ) : null}

        {!hasHistory ? (
          <EmptyState
            title={t('screens.exercise.detail.noHistoryTitle')}
            description={t('screens.exercise.detail.noHistoryDescription')}
          />
        ) : isCardio ? (
          <>
            {data.cardioRecords ? (
              <CardioRecordsCard
                modality={data.cardioRecords.modality}
                records={data.cardioRecords.records}
              />
            ) : null}
            <Card>
              <CardHeader title={t('screens.exercise.detail.recentSessions')} as="h2" />
              <ul className="grid gap-1.5 text-sm">
                {summary!.recent.map((point) => (
                  <li key={point.startedAt} className="flex justify-between gap-2">
                    <span className="text-muted">{formatDate(point.date)}</span>
                    <span className="numeric font-medium">
                      {point.cardioDurationSeconds != null
                        ? formatCardioDuration(point.cardioDurationSeconds)
                        : '–'}
                      {point.cardioDistanceMeters != null
                        ? ` · ${formatCardioDistance(point.cardioDistanceMeters, exercise.cardioModality)}`
                        : ''}
                      {point.cardioPace ? ` · ${formatPace(point.cardioPace)}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardHeader title={t('screens.exercise.detail.recordAndLatest')} as="h2" />
              <div className="grid grid-cols-2 gap-2">
                <Stat
                  label={t('screens.exercise.detail.bestE1rm')}
                  value={
                    summary!.bestE1rm != null
                      ? t('screens.exercise.detail.estimatePrefix', {
                          value: formatKg(summary!.bestE1rm),
                        })
                      : '–'
                  }
                  hint={t('screens.exercise.detail.estimateHint')}
                  tone="accent"
                />
                <Stat
                  label={t('screens.exercise.detail.heaviestSet')}
                  value={
                    summary!.bestLoadKg != null ? formatKg(summary!.bestLoadKg) : '–'
                  }
                  hint={
                    summary!.bestLoadReps != null
                      ? t('screens.exercise.detail.reps', {
                          value: formatNumber(summary!.bestLoadReps),
                        })
                      : undefined
                  }
                />
                {summary!.last ? (
                  <Stat
                    label={t('screens.exercise.detail.latest')}
                    value={formatDate(summary!.last.date)}
                    hint={
                      summary!.last.volumeKg != null
                        ? t('screens.exercise.detail.volume', {
                            value: formatVolume(summary!.last.volumeKg),
                          })
                        : undefined
                    }
                  />
                ) : null}
              </div>
            </Card>

            {chartPoints.length > 1 ? (
              <ChartFrame
                title={t('screens.exercise.detail.chartTitle')}
                summary={t('screens.exercise.detail.chartSummary', {
                  amount: chartPoints.length,
                })}
                table={
                  <DataTable
                    caption={t('screens.exercise.detail.chartCaption')}
                    columns={[t('screens.exercise.detail.date'), 'e1RM']}
                    rows={data.recent8w
                      .filter((point) => point.estimatedOneRepMax != null)
                      .map((point) => [
                        formatDate(point.date),
                        formatKg(point.estimatedOneRepMax),
                      ])}
                  />
                }
              >
                <SimpleLineChart data={chartPoints} formatValue={(v) => formatKg(v)} />
              </ChartFrame>
            ) : null}

            <Card>
              <CardHeader title={t('screens.exercise.detail.recentSessions')} as="h2" />
              <ul className="grid gap-1.5 text-sm">
                {summary!.recent.map((point) => (
                  <li key={point.startedAt} className="flex justify-between gap-2">
                    <span className="text-muted">{formatDate(point.date)}</span>
                    <span className="numeric font-medium">
                      {point.topSetLoadKg != null
                        ? `${formatKg(point.topSetLoadKg)}${
                            point.topSetReps != null ? ` × ${point.topSetReps}` : ''
                          }`
                        : point.volumeKg != null
                          ? t('screens.exercise.detail.volume', {
                              value: formatVolume(point.volumeKg),
                            })
                          : `${formatDurationLong(point.maxDurationSeconds ?? 0)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
