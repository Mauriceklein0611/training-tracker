import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { muscleGroupDisplayLabel } from '@/constants/muscleGroups';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, GitCompareArrows } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, EmptyState, Stat } from '@/components/ui/Card';
import { Segmented, SelectField, TextField } from '@/components/ui/Field';
import {
  DataTable,
  ChartFrame,
  HorizontalBarChart,
  SimpleBarChart,
  SimpleLineChart,
} from '@/features/analytics/Charts';
import { loadAnalyticsDataset } from '@/services/dataset';
import { filterDatasetByDeload, type DeloadFilter } from '@/services/analysisFilters';
import {
  computeAnalytics,
  computeExerciseCardioRecords,
  computeExerciseSeries,
  listTrackedExercises,
  type ExerciseSeriesPoint,
} from '@/services/analytics';
import { analyzePlateau } from '@/services/plateau';
import { buildPeriodReview } from '@/services/periodReview';
import { buildRegionExerciseUsage } from '@/services/regionUsage';
import { PlateauHint } from '@/features/analytics/PlateauHint';
import { CardioRecordsCard } from '@/features/analytics/CardioRecordsCard';
import { PeriodReviewCard } from '@/features/analytics/PeriodReviewCard';
import { SkeletonStats } from '@/components/ui/Skeleton';
import { AnatomyBodyMap } from '@/features/muscles/AnatomyBodyMap';
import { slugForMuscle, slugLabel } from '@/features/muscles/muscleLibrary';
import type { Slug } from 'react-muscle-highlighter';
import { ONE_RM_MAX_REPS, ONE_RM_MIN_REPS } from '@/services/metrics';
import { useSettings } from '@/hooks/useSettings';
import type { AnalyticsRangeKey } from '@/types';
import {
  customRange,
  dayKey,
  formatDate,
  formatDurationLong,
  lastDaysRange,
  todayKey,
} from '@/utils/date';
import {
  formatKg,
  formatNumber,
  formatPercent,
  formatSets,
  formatSignedSeconds,
  formatVolume,
} from '@/utils/format';
import {
  formatCardioDistance,
  formatDuration as formatCardioDuration,
  formatPace,
} from '@/services/cardioMetrics';
import { exerciseDisplayName } from '@/utils/exerciseDisplay';

type Metric =
  | 'volume'
  | 'topSet'
  | 'oneRm'
  | 'reps'
  | 'duration'
  | 'cardioDuration'
  | 'cardioDistance'
  | 'cardioPace';

// Which metrics make sense for which kind of exercise. A cardio activity like
// "Laufen" must never offer Volumen, schwerster Satz, 1RM or Wiederholungen as
// primary options, and a strength exercise never offers pace/distance.
const STRENGTH_METRICS: Metric[] = ['volume', 'topSet', 'oneRm', 'reps', 'duration'];
const CARDIO_METRICS: Metric[] = ['cardioDuration', 'cardioDistance', 'cardioPace'];

export default function AnalyticsPage() {
  const { t } = useTranslation('analytics');
  const { t: tCommon } = useTranslation();
  const { t: tDomain } = useTranslation('domain');
  const { settings } = useSettings();
  const [rangeKey, setRangeKey] = useState<AnalyticsRangeKey>(
    settings.defaultAnalyticsRange,
  );
  const [customFrom, setCustomFrom] = useState(() =>
    dayKey(new Date(Date.now() - 30 * 86400000)),
  );
  const [customTo, setCustomTo] = useState(() => todayKey());
  const [exerciseId, setExerciseId] = useState('');
  const [metric, setMetric] = useState<Metric>('volume');
  const [deloadFilter, setDeloadFilter] = useState<DeloadFilter>('include');
  const [selectedSlug, setSelectedSlug] = useState<Slug | undefined>();
  const [view, setView] = useState<'overview' | 'strength' | 'cardio' | 'body'>(
    'overview',
  );
  const rangeOptions: { value: AnalyticsRangeKey; label: string }[] = [
    { value: '7d', label: t('range.days7') },
    { value: '30d', label: t('range.days30') },
    { value: '90d', label: t('range.days90') },
    { value: 'all', label: t('range.all') },
    { value: 'custom', label: t('range.custom') },
  ];
  const metricLabels: Record<Metric, string> = {
    volume: t('metrics.volume'),
    topSet: t('metrics.topSet'),
    oneRm: t('metrics.oneRm'),
    reps: t('metrics.reps'),
    duration: t('metrics.duration'),
    cardioDuration: t('metrics.cardioDuration'),
    cardioDistance: t('metrics.cardioDistance'),
    cardioPace: t('metrics.cardioPace'),
  };

  const range = useMemo(() => {
    switch (rangeKey) {
      case '7d':
        return lastDaysRange(7);
      case '30d':
        return lastDaysRange(30);
      case '90d':
        return lastDaysRange(90);
      case 'custom':
        return customFrom && customTo ? customRange(customFrom, customTo) : null;
      case 'all':
        return null;
    }
  }, [rangeKey, customFrom, customTo]);

  const data = useLiveQuery(async () => {
    // A deliberate deload must not read as a plateau; let the user include,
    // exclude or isolate deload sessions before anything is computed.
    const dataset = filterDatasetByDeload(await loadAnalyticsDataset(), deloadFilter);
    const exercises = listTrackedExercises(dataset);
    const selected = exercises.find((entry) => entry.id === exerciseId);
    return {
      analytics: computeAnalytics(dataset, range),
      exercises,
      exerciseById: new Map(dataset.exercises.map((exercise) => [exercise.id, exercise])),
      series: exerciseId ? computeExerciseSeries(dataset, exerciseId, range) : [],
      // The plateau hint looks at the full history, so "recent" really means the
      // latest sessions rather than only those inside the selected range.
      plateau:
        exerciseId && selected
          ? analyzePlateau(
              computeExerciseSeries(dataset, exerciseId, null),
              selected.trackingType,
            )
          : null,
      // Cardio bests over the whole history of this exercise (one modality), so
      // the picked range never hides an earlier personal best.
      cardioRecords:
        exerciseId && selected?.trackingType === 'cardio'
          ? computeExerciseCardioRecords(dataset, exerciseId, null)
          : null,
      // Local "wrapped" for the selected range vs the equal period before it.
      // Only for a bounded range — "Gesamt" has no meaningful previous period.
      review: range ? buildPeriodReview(dataset, range) : null,
      // Exercises per body region for the tappable muscle map.
      regionExercises: buildRegionExerciseUsage(dataset, range),
    };
  }, [range, exerciseId, deloadFilter]);

  const analytics = data?.analytics;
  const trackedExercises = data?.exercises ?? [];
  const selectedExercise = trackedExercises.find((entry) => entry.id === exerciseId);
  const displayExerciseName = (id: string, fallback: string): string => {
    const exercise = data?.exerciseById.get(id);
    return exercise ? exerciseDisplayName(exercise) : fallback;
  };

  // The metric picker follows the exercise's tracking type: cardio activities
  // never expose strength metrics (Volumen, 1RM, …) and vice versa.
  const isCardioExercise = selectedExercise?.trackingType === 'cardio';
  const availableMetrics = isCardioExercise ? CARDIO_METRICS : STRENGTH_METRICS;

  // Keep the selected metric valid for the chosen exercise; when switching
  // between a strength and a cardio exercise, fall back to that type's default.
  useEffect(() => {
    if (!availableMetrics.includes(metric)) setMetric(availableMetrics[0]);
  }, [availableMetrics, metric]);

  // Pace convention for the selected cardio exercise, taken from its history so
  // the pace axis is labelled in the modality's unit (min/km, /500 m, km/h …).
  const cardioPaceKind = useMemo(
    () => (data?.series ?? []).find((point) => point.cardioPace)?.cardioPace?.kind,
    [data?.series],
  );

  const weeklyPoints = useMemo(
    () =>
      (analytics?.weekly ?? []).map((week) => ({
        label: formatDate(week.week).slice(0, 6),
        value: Math.round(week.volumeKg),
      })),
    [analytics],
  );

  // For the body map: directly-worked muscles are primary, indirect-only ones
  // secondary — a heatmap of what the selected range actually trained.
  const trainedMuscles = useMemo(() => {
    const groups = analytics?.muscleGroups ?? [];
    return {
      primary: groups.filter((g) => g.directSets > 0).map((g) => g.muscleGroup),
      secondary: groups
        .filter((g) => g.directSets === 0 && g.indirectSets > 0)
        .map((g) => g.muscleGroup),
    };
  }, [analytics]);

  // Breakdown of the tapped body region: the catalog muscle groups it covers
  // that were trained in the selected range, with their sets and volume.
  const regionDetail = useMemo(() => {
    if (!selectedSlug) return null;
    const label = slugLabel(selectedSlug);
    const groups = (analytics?.muscleGroups ?? []).filter(
      (group) =>
        slugForMuscle(group.muscleGroup) === selectedSlug &&
        (group.directSets > 0 || group.indirectSets > 0),
    );
    return { label, groups };
  }, [selectedSlug, analytics]);

  const musclePoints = useMemo(
    () =>
      (analytics?.muscleGroups ?? [])
        .filter((group) => group.directSets > 0)
        .slice(0, 10)
        .map((group) => ({
          label: muscleGroupDisplayLabel(group.muscleGroup),
          value: group.directSets,
        })),
    [analytics],
  );

  const cardioMinutePoints = useMemo(
    () =>
      (analytics?.cardioWeekly ?? []).map((week) => ({
        label: formatDate(week.week).slice(0, 6),
        value: Math.round(week.minutes),
      })),
    [analytics],
  );

  const cardioDistancePoints = useMemo(
    () =>
      (analytics?.cardioWeekly ?? [])
        .filter((week) => week.distanceMeters > 0)
        .map((week) => ({
          label: formatDate(week.week).slice(0, 6),
          // Kilometres, one decimal, for a readable axis.
          value: Math.round(week.distanceMeters / 100) / 10,
        })),
    [analytics],
  );

  const seriesPoints = useMemo(() => {
    const points = data?.series ?? [];
    return points.map((point) => {
      const value =
        metric === 'volume'
          ? point.volumeKg
          : metric === 'topSet'
            ? point.topSetLoadKg
            : metric === 'oneRm'
              ? point.estimatedOneRepMax
              : metric === 'reps'
                ? point.totalReps
                : metric === 'duration'
                  ? point.maxDurationSeconds
                  : metric === 'cardioDuration'
                    ? point.cardioDurationSeconds
                    : metric === 'cardioDistance'
                      ? point.cardioDistanceMeters
                      : point.cardioPace?.value;
      return {
        label: formatDate(point.date).slice(0, 6),
        value: value == null ? null : Math.round(value * 10) / 10,
      };
    });
  }, [data?.series, metric]);

  const metricFormatter = (value: number) => {
    if (metric === 'reps') return formatNumber(value);
    if (metric === 'duration') return `${formatNumber(value)} s`;
    if (metric === 'volume') return formatVolume(value);
    if (metric === 'cardioDuration') return formatCardioDuration(value);
    if (metric === 'cardioDistance') return formatCardioDistance(value, undefined);
    if (metric === 'cardioPace')
      return cardioPaceKind
        ? formatPace({ kind: cardioPaceKind, value })
        : formatNumber(value);
    return formatKg(value);
  };

  // Value cell for the per-session data table, from raw (unrounded) figures.
  const metricCell = (point: ExerciseSeriesPoint): string => {
    switch (metric) {
      case 'volume':
        return formatVolume(point.volumeKg);
      case 'topSet':
        return formatKg(point.topSetLoadKg);
      case 'oneRm':
        return formatKg(point.estimatedOneRepMax);
      case 'reps':
        return formatNumber(point.totalReps);
      case 'duration':
        return point.maxDurationSeconds == null
          ? '–'
          : `${formatNumber(point.maxDurationSeconds)} s`;
      case 'cardioDuration':
        return point.cardioDurationSeconds == null
          ? '–'
          : formatCardioDuration(point.cardioDurationSeconds);
      case 'cardioDistance':
        return point.cardioDistanceMeters == null
          ? '–'
          : formatCardioDistance(point.cardioDistanceMeters, undefined);
      case 'cardioPace':
        return point.cardioPace ? formatPace(point.cardioPace) : '–';
    }
  };

  const hasData = (analytics?.sessionCount ?? 0) > 0;

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {/* The three comparison entry points live in one "Vergleichen" card so
       * they read as a single tool, not three competing actions. */}
      <section
        aria-labelledby="compare-heading"
        className="mb-3 rounded-2xl border border-border bg-surface p-3"
      >
        <h2
          id="compare-heading"
          className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"
        >
          <GitCompareArrows size={14} className="text-accent" aria-hidden="true" />
          {t('compare.title')}
        </h2>
        <div className="grid">
          {[
            { to: '/analyse/vergleich', label: t('compare.periods') },
            { to: '/analyse/plaene-vergleich', label: t('compare.plans') },
            { to: '/analyse/einheiten-vergleich', label: t('compare.units') },
          ].map((entry) => (
            <Link
              key={entry.to}
              to={entry.to}
              className="flex min-h-[48px] items-center justify-between gap-2 border-t border-border text-sm font-medium first:border-t-0 active:bg-surface-2"
            >
              {entry.label}
              <ChevronRight size={18} className="text-muted" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      <Segmented
        label={t('range.label')}
        className="mb-3"
        options={rangeOptions}
        value={rangeKey}
        onChange={setRangeKey}
      />

      {rangeKey === 'custom' ? (
        <div className="mb-4 grid grid-cols-2 gap-2">
          <TextField
            label={t('range.from')}
            type="date"
            value={customFrom}
            onChange={(event) => setCustomFrom(event.target.value)}
          />
          <TextField
            label={t('range.to')}
            type="date"
            value={customTo}
            onChange={(event) => setCustomTo(event.target.value)}
          />
        </div>
      ) : null}

      <SelectField
        label={t('deload.label')}
        className="mb-4"
        value={deloadFilter}
        onChange={(event) => setDeloadFilter(event.target.value as DeloadFilter)}
      >
        {(['include', 'exclude', 'only'] as DeloadFilter[]).map((key) => (
          <option key={key} value={key}>
            {t(`deload.${key}`)}
          </option>
        ))}
      </SelectField>

      {hasData ? (
        <Segmented
          label={t('view.label')}
          className="mb-4"
          value={view}
          onChange={setView}
          options={[
            { value: 'overview', label: t('view.overview') },
            { value: 'strength', label: t('view.strength') },
            { value: 'cardio', label: t('view.cardio') },
            { value: 'body', label: t('view.body') },
          ]}
        />
      ) : null}

      {!analytics ? (
        <div aria-busy="true">
          <SkeletonStats count={6} />
        </div>
      ) : !hasData ? (
        <EmptyState title={t('empty.title')} description={t('empty.description')} />
      ) : (
        <div className="grid gap-4">
          {view === 'overview' ? (
            <>
              {data?.review ? <PeriodReviewCard review={data.review} /> : null}
              <section aria-label={t('overview.aria')} className="grid grid-cols-2 gap-2">
                <Stat
                  label={t('overview.sessions')}
                  value={formatNumber(analytics.sessionCount)}
                  tone="accent"
                />
                <Stat
                  label={t('overview.trainingDays')}
                  value={formatNumber(analytics.trainingDays)}
                />
                <Stat
                  label={t('overview.daysPerWeek')}
                  value={formatNumber(analytics.trainingDaysPerWeek, 1)}
                  hint={t('overview.average')}
                />
                <Stat
                  label={t('overview.consistency')}
                  value={formatPercent(analytics.consistency)}
                  hint={t('overview.weeksWithTraining')}
                />
                <Stat
                  label={t('overview.totalDuration')}
                  value={formatDurationLong(analytics.totalDurationSeconds)}
                />
                <Stat
                  label={t('overview.averageDuration')}
                  value={
                    analytics.averageDurationSeconds == null
                      ? '–'
                      : formatDurationLong(analytics.averageDurationSeconds)
                  }
                />
                <Stat
                  label={t('overview.workingSets')}
                  value={formatNumber(analytics.workingSetCount)}
                  sparkline={analytics.weekly.map((week) => week.workingSets)}
                />
                <Stat
                  label={t('overview.repetitions')}
                  value={formatNumber(analytics.totalReps)}
                />
                <Stat
                  label={t('overview.volume')}
                  value={formatVolume(analytics.volume.volumeKg)}
                  hint={t('overview.weightedOnly')}
                  sparkline={analytics.weekly.map((week) => week.volumeKg)}
                />
                <Stat
                  label={t('overview.streak')}
                  value={t('overview.weekShort', {
                    value: formatNumber(analytics.streakWeeks),
                  })}
                  hint={t('overview.consecutiveWeeks')}
                />
              </section>
            </>
          ) : null}

          {view === 'strength' ? (
            <>
              <ChartFrame
                title={t('strength.weeklyVolume')}
                empty={weeklyPoints.length === 0}
                summary={
                  weeklyPoints.length === 0
                    ? t('strength.noWeeklyVolume')
                    : t('strength.weeklyVolumeSummary', {
                        count: weeklyPoints.length,
                        highest: formatVolume(
                          Math.max(...weeklyPoints.map((point) => point.value)),
                        ),
                        latest: formatVolume(weeklyPoints[weeklyPoints.length - 1].value),
                      })
                }
                table={
                  <DataTable
                    caption={t('strength.volumeCaption')}
                    columns={[
                      t('table.week'),
                      t('table.volume'),
                      t('table.sets'),
                      t('table.sessions'),
                    ]}
                    rows={analytics.weekly.map((week) => [
                      formatDate(week.week),
                      formatVolume(week.volumeKg),
                      week.workingSets,
                      week.sessions,
                    ])}
                  />
                }
              >
                <SimpleBarChart data={weeklyPoints} formatValue={formatVolume} />
              </ChartFrame>

              <ChartFrame
                title={t('strength.muscleSets')}
                empty={musclePoints.length === 0}
                summary={
                  musclePoints.length === 0
                    ? t('strength.noMuscleSets')
                    : t('strength.muscleSummary', {
                        name: musclePoints[0].label,
                        count: musclePoints[0].value,
                        sets:
                          musclePoints[0].value === 1
                            ? tCommon('units.setOne')
                            : tCommon('units.setOther'),
                      })
                }
                table={
                  <DataTable
                    caption={t('strength.muscleCaption')}
                    columns={[
                      t('table.muscleGroup'),
                      t('table.direct'),
                      t('table.indirect'),
                      t('table.reps'),
                      t('table.volume'),
                    ]}
                    rows={analytics.muscleGroups.map((group) => [
                      muscleGroupDisplayLabel(group.muscleGroup),
                      group.directSets,
                      group.indirectSets,
                      group.totalReps,
                      formatVolume(group.volumeKg),
                    ])}
                  />
                }
              >
                <HorizontalBarChart
                  data={musclePoints}
                  formatValue={formatNumber}
                  allowDecimals={false}
                />
                {trainedMuscles.primary.length > 0 ? (
                  <div className="mt-3 border-t border-border pt-3">
                    <AnatomyBodyMap
                      primary={trainedMuscles.primary}
                      secondary={trainedMuscles.secondary}
                      selectedSlug={selectedSlug}
                      onSelectSlug={(slug) =>
                        setSelectedSlug((current) =>
                          current === slug ? undefined : slug,
                        )
                      }
                    />
                    <p className="mt-1 text-center text-xs text-muted">
                      {t('strength.tapRegion')}
                    </p>
                    {regionDetail ? (
                      <div className="mt-2 rounded-xl border border-border bg-surface-2 p-3 text-sm">
                        <p className="font-medium">{regionDetail.label}</p>
                        {regionDetail.groups.length > 0 ? (
                          <ul className="mt-1 grid gap-1">
                            {regionDetail.groups.map((group) => (
                              <li
                                key={group.muscleGroup}
                                className="flex justify-between gap-2"
                              >
                                <span className="text-muted">
                                  {muscleGroupDisplayLabel(group.muscleGroup)}
                                </span>
                                <span className="numeric">
                                  {formatNumber(group.directSets)} {t('strength.direct')}{' '}
                                  · {formatVolume(group.volumeKg)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-muted">{t('strength.noRegionSets')}</p>
                        )}
                        {(data?.regionExercises[selectedSlug!] ?? []).length > 0 ? (
                          <div className="mt-2 border-t border-border pt-2">
                            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                              {t('strength.exercises')}
                            </p>
                            <ul className="grid gap-1">
                              {(data?.regionExercises[selectedSlug!] ?? [])
                                .slice(0, 6)
                                .map((usage) => (
                                  <li
                                    key={usage.exerciseName}
                                    className="flex justify-between gap-2"
                                  >
                                    <span className="truncate">{usage.exerciseName}</span>
                                    <span className="numeric shrink-0 text-muted">
                                      {formatSets(usage.sets)} ·{' '}
                                      {formatNumber(usage.sessions)}×
                                    </span>
                                  </li>
                                ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </ChartFrame>

              <Card>
                <CardHeader
                  title={t('strength.development')}
                  subtitle={t('strength.developmentSubtitle')}
                  as="h3"
                />
                <div className="grid gap-2">
                  <SelectField
                    label={t('strength.exercise')}
                    value={exerciseId}
                    onChange={(event) => setExerciseId(event.target.value)}
                  >
                    <option value="">{t('strength.choose')}</option>
                    {trackedExercises.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {displayExerciseName(entry.id, entry.name)}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField
                    label={t('strength.metric')}
                    value={metric}
                    disabled={!exerciseId}
                    onChange={(event) => setMetric(event.target.value as Metric)}
                  >
                    {availableMetrics.map((key) => (
                      <option key={key} value={key}>
                        {metricLabels[key]}
                      </option>
                    ))}
                  </SelectField>
                </div>

                {exerciseId ? (
                  <div className="mt-3">
                    <ChartFrame
                      title={`${
                        selectedExercise
                          ? displayExerciseName(
                              selectedExercise.id,
                              selectedExercise.name,
                            )
                          : t('view.strength')
                      } — ${metricLabels[metric]}`}
                      empty={seriesPoints.every((point) => point.value == null)}
                      summary={
                        metric === 'oneRm'
                          ? t('strength.oneRmSummary', {
                              min: ONE_RM_MIN_REPS,
                              max: ONE_RM_MAX_REPS,
                            })
                          : t('strength.seriesSummary', {
                              count: seriesPoints.length,
                            })
                      }
                      table={
                        <DataTable
                          caption={t('strength.perSession', {
                            metric: metricLabels[metric],
                          })}
                          columns={
                            isCardioExercise
                              ? [t('table.date'), t('table.value'), t('table.sections')]
                              : [
                                  t('table.date'),
                                  t('table.value'),
                                  t('table.sets'),
                                  t('table.reps'),
                                ]
                          }
                          rows={(data?.series ?? []).map((point) =>
                            isCardioExercise
                              ? [
                                  formatDate(point.date),
                                  metricCell(point),
                                  point.workingSets,
                                ]
                              : [
                                  formatDate(point.date),
                                  metricCell(point),
                                  point.workingSets,
                                  point.totalReps,
                                ],
                          )}
                        />
                      }
                    >
                      <SimpleLineChart
                        data={seriesPoints}
                        formatValue={metricFormatter}
                        // Rep counts are whole numbers; other metrics vary.
                        allowDecimals={metric !== 'reps'}
                      />
                    </ChartFrame>
                    {data?.cardioRecords ? (
                      <CardioRecordsCard
                        modality={data.cardioRecords.modality}
                        records={data.cardioRecords.records}
                      />
                    ) : null}
                    {data?.plateau ? <PlateauHint analysis={data.plateau} /> : null}
                  </div>
                ) : null}
              </Card>

              <Card>
                <CardHeader title={t('strength.rests')} as="h3" />
                <div className="grid grid-cols-2 gap-2">
                  <Stat
                    label={t('strength.averageRest')}
                    value={
                      analytics.restStatistics.averageActualSeconds == null
                        ? '–'
                        : `${Math.round(analytics.restStatistics.averageActualSeconds)} s`
                    }
                  />
                  <Stat
                    label={t('strength.averageDeviation')}
                    value={formatSignedSeconds(
                      analytics.restStatistics.averageDeviationSeconds,
                    )}
                    hint={t('strength.targetRestHint')}
                  />
                  <Stat
                    label={t('strength.targetMet')}
                    value={formatPercent(analytics.restStatistics.targetMetRatio)}
                    hint={t('strength.restShare')}
                  />
                  <Stat
                    label={t('strength.evaluatedRests')}
                    value={formatNumber(analytics.restStatistics.evaluatedSets)}
                  />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  {t('strength.restExplanation')}
                </p>
              </Card>
            </>
          ) : null}

          {view === 'cardio' && analytics.cardio.activities === 0 ? (
            <EmptyState
              title={t('cardio.emptyTitle')}
              description={t('cardio.emptyDescription')}
            />
          ) : null}

          {view === 'cardio' && analytics.cardio.activities > 0 ? (
            <Card>
              <CardHeader title="Cardio" subtitle={t('cardio.subtitle')} as="h3" />
              <div className="grid grid-cols-2 gap-2">
                <Stat
                  label={t('cardio.activities')}
                  value={formatNumber(analytics.cardio.activities)}
                />
                <Stat
                  label={t('cardio.duration')}
                  value={formatCardioDuration(analytics.cardio.totalDurationSeconds)}
                />
                {analytics.cardio.totalDistanceMeters > 0 ? (
                  <Stat
                    label={t('cardio.distance')}
                    value={formatCardioDistance(
                      analytics.cardio.totalDistanceMeters,
                      undefined,
                    )}
                  />
                ) : null}
                {analytics.cardio.averageHeartRateBpm != null ? (
                  <Stat
                    label={t('cardio.heartRate')}
                    value={`${Math.round(analytics.cardio.averageHeartRateBpm)} bpm`}
                    hint={t('cardio.recorded')}
                  />
                ) : null}
                {analytics.cardio.totalCaloriesKcal > 0 ? (
                  <Stat
                    label={t('cardio.calories')}
                    value={`${formatNumber(analytics.cardio.totalCaloriesKcal)} kcal`}
                    hint={t('cardio.captured')}
                  />
                ) : null}
                {analytics.cardio.totalElevationGainMeters > 0 ? (
                  <Stat
                    label={t('cardio.elevation')}
                    value={`${formatNumber(analytics.cardio.totalElevationGainMeters)} m`}
                  />
                ) : null}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                {t('cardio.explanation')}
              </p>

              <div className="mt-3 grid gap-4">
                <ChartFrame
                  title={t('cardio.weeklyMinutes')}
                  empty={cardioMinutePoints.length === 0}
                  summary={
                    cardioMinutePoints.length === 0
                      ? t('cardio.noMinutes')
                      : t('cardio.minutesSummary', {
                          count: cardioMinutePoints.length,
                        })
                  }
                  table={
                    <DataTable
                      caption={t('cardio.weeklyMinutes')}
                      columns={[
                        t('table.week'),
                        t('table.minutes'),
                        t('table.activities'),
                      ]}
                      rows={(analytics.cardioWeekly ?? []).map((week) => [
                        formatDate(week.week),
                        Math.round(week.minutes),
                        week.activities,
                      ])}
                    />
                  }
                >
                  <SimpleBarChart
                    data={cardioMinutePoints}
                    formatValue={(value) => `${value} min`}
                  />
                </ChartFrame>

                {cardioDistancePoints.length > 0 ? (
                  <ChartFrame
                    title={t('cardio.weeklyDistance')}
                    empty={false}
                    summary={t('cardio.distanceSummary', {
                      count: cardioDistancePoints.length,
                    })}
                    table={
                      <DataTable
                        caption={t('cardio.weeklyDistance')}
                        columns={[t('table.week'), t('table.distanceKm')]}
                        rows={(analytics.cardioWeekly ?? [])
                          .filter((week) => week.distanceMeters > 0)
                          .map((week) => [
                            formatDate(week.week),
                            Math.round(week.distanceMeters / 100) / 10,
                          ])}
                      />
                    }
                  >
                    <SimpleBarChart
                      data={cardioDistancePoints}
                      formatValue={(value) => `${value} km`}
                    />
                  </ChartFrame>
                ) : null}
              </div>
            </Card>
          ) : null}

          {view === 'body' ? (
            <Card>
              <CardHeader title={t('body.title')} subtitle={t('body.subtitle')} as="h3" />
              <p className="mb-3 text-sm text-muted">{t('body.text')}</p>
              <Link
                to="/mehr/koerpergewicht"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-border bg-surface px-4 text-sm font-medium text-accent active:bg-surface-2"
              >
                {t('body.open')}
              </Link>
            </Card>
          ) : null}

          {view === 'overview' ? (
            <>
              <Card>
                <CardHeader title={t('records.title')} as="h3" />
                {analytics.personalRecords.length === 0 ? (
                  <p className="text-sm text-muted">{t('records.empty')}</p>
                ) : (
                  <ul className="grid gap-2">
                    {analytics.personalRecords.map((record) => (
                      <li
                        key={`${record.exerciseId} ${record.equipment} ${record.weightMode}`}
                        className="border-t border-border pt-2 first:border-0 first:pt-0"
                      >
                        <p className="font-medium">
                          {displayExerciseName(record.exerciseId, record.exerciseName)}
                          {record.equipment !== 'unspecified' ? (
                            <span className="font-normal text-muted">
                              {' '}
                              · {tDomain(`equipment.${record.equipment}`)}
                            </span>
                          ) : null}
                        </p>
                        <p className="numeric mt-0.5 text-sm text-muted">
                          {record.bestLoadKg != null
                            ? `${t('records.bestLoad', {
                                value: formatKg(record.bestLoadKg),
                              })}${record.bestLoadReps ? ` × ${record.bestLoadReps}` : ''}`
                            : null}
                          {record.bestEstimatedOneRepMax != null
                            ? ` · ${t('records.estimate', {
                                value: formatKg(record.bestEstimatedOneRepMax),
                              })}`
                            : null}
                          {record.bestReps != null
                            ? ` · ${t('records.maxReps', { count: record.bestReps })}`
                            : null}
                          {record.bestDurationSeconds != null
                            ? ` · ${t('records.maxSeconds', {
                                count: Math.round(record.bestDurationSeconds),
                              })}`
                            : null}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {analytics.setsWithoutVolume > 0 ? (
                <p className="text-xs leading-relaxed text-muted">
                  {t('dataQuality', { count: analytics.setsWithoutVolume })}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </>
  );
}
