import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { GitCompareArrows } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, EmptyState, Stat } from '@/components/ui/Card';
import { equipmentLabel } from '@/services/equipment';
import { Segmented, SelectField, TextField } from '@/components/ui/Field';
import {
  DataTable,
  ChartFrame,
  HorizontalBarChart,
  SimpleBarChart,
  SimpleLineChart,
} from '@/features/analytics/Charts';
import { loadAnalyticsDataset } from '@/services/dataset';
import {
  DELOAD_FILTER_LABELS,
  filterDatasetByDeload,
  type DeloadFilter,
} from '@/services/analysisFilters';
import {
  computeAnalytics,
  computeExerciseSeries,
  listTrackedExercises,
  type ExerciseSeriesPoint,
} from '@/services/analytics';
import { analyzePlateau } from '@/services/plateau';
import { PlateauHint } from '@/features/analytics/PlateauHint';
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
  formatSignedSeconds,
  formatVolume,
} from '@/utils/format';
import {
  formatCardioDistance,
  formatDuration as formatCardioDuration,
  formatPace,
} from '@/services/cardioMetrics';

const RANGE_OPTIONS: { value: AnalyticsRangeKey; label: string }[] = [
  { value: '7d', label: '7 T.' },
  { value: '30d', label: '30 T.' },
  { value: '90d', label: '90 T.' },
  { value: 'all', label: 'Gesamt' },
  { value: 'custom', label: 'Eigen' },
];

type Metric =
  | 'volume'
  | 'topSet'
  | 'oneRm'
  | 'reps'
  | 'duration'
  | 'cardioDuration'
  | 'cardioDistance'
  | 'cardioPace';

const METRIC_LABELS: Record<Metric, string> = {
  volume: 'Volumen je Einheit',
  topSet: 'Schwerster Satz (Gesamtlast)',
  oneRm: 'Geschätztes 1RM (Schätzwert)',
  reps: 'Wiederholungen je Einheit',
  duration: 'Längster Zeitsatz',
  cardioDuration: 'Dauer je Einheit',
  cardioDistance: 'Distanz je Einheit',
  cardioPace: 'Pace / Geschwindigkeit',
};

// Which metrics make sense for which kind of exercise. A cardio activity like
// "Laufen" must never offer Volumen, schwerster Satz, 1RM or Wiederholungen as
// primary options, and a strength exercise never offers pace/distance.
const STRENGTH_METRICS: Metric[] = ['volume', 'topSet', 'oneRm', 'reps', 'duration'];
const CARDIO_METRICS: Metric[] = ['cardioDuration', 'cardioDistance', 'cardioPace'];

export default function AnalyticsPage() {
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
    };
  }, [range, exerciseId, deloadFilter]);

  const analytics = data?.analytics;
  const trackedExercises = data?.exercises ?? [];
  const selectedExercise = trackedExercises.find((entry) => entry.id === exerciseId);

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

  const musclePoints = useMemo(
    () =>
      (analytics?.muscleGroups ?? [])
        .filter((group) => group.directSets > 0)
        .slice(0, 10)
        .map((group) => ({ label: group.muscleGroup, value: group.directSets })),
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
      <PageHeader
        title="Analyse"
        subtitle="Berechnet ausschließlich aus deinen lokalen Daten"
      />

      <div className="mb-3 grid gap-2">
        <Link
          to="/analyse/vergleich"
          className="flex min-h-[48px] items-center gap-2 rounded-2xl border border-border bg-surface px-4 text-sm font-medium active:bg-surface-2"
        >
          <GitCompareArrows size={18} className="text-accent" aria-hidden="true" />
          Trainingsblöcke vergleichen
        </Link>
        <Link
          to="/analyse/plaene-vergleich"
          className="flex min-h-[48px] items-center gap-2 rounded-2xl border border-border bg-surface px-4 text-sm font-medium active:bg-surface-2"
        >
          <GitCompareArrows size={18} className="text-accent" aria-hidden="true" />
          Pläne vergleichen
        </Link>
        <Link
          to="/analyse/einheiten-vergleich"
          className="flex min-h-[48px] items-center gap-2 rounded-2xl border border-border bg-surface px-4 text-sm font-medium active:bg-surface-2"
        >
          <GitCompareArrows size={18} className="text-accent" aria-hidden="true" />
          Einheiten vergleichen
        </Link>
      </div>

      <Segmented
        label="Zeitraum"
        className="mb-3"
        options={RANGE_OPTIONS}
        value={rangeKey}
        onChange={setRangeKey}
      />

      {rangeKey === 'custom' ? (
        <div className="mb-4 grid grid-cols-2 gap-2">
          <TextField
            label="Von"
            type="date"
            value={customFrom}
            onChange={(event) => setCustomFrom(event.target.value)}
          />
          <TextField
            label="Bis"
            type="date"
            value={customTo}
            onChange={(event) => setCustomTo(event.target.value)}
          />
        </div>
      ) : null}

      <SelectField
        label="Deload"
        className="mb-4"
        value={deloadFilter}
        onChange={(event) => setDeloadFilter(event.target.value as DeloadFilter)}
      >
        {(Object.keys(DELOAD_FILTER_LABELS) as DeloadFilter[]).map((key) => (
          <option key={key} value={key}>
            {DELOAD_FILTER_LABELS[key]}
          </option>
        ))}
      </SelectField>

      {!analytics ? (
        <p className="text-sm text-muted" role="status">
          Auswertung wird berechnet …
        </p>
      ) : !hasData ? (
        <EmptyState
          title="Noch keine Auswertung möglich"
          description="Schließe deine erste Trainingseinheit ab, damit hier Trainingshäufigkeit, Volumen, Pausenverhalten und Bestleistungen berechnet werden können. Es werden ausschließlich Werte angezeigt, die sich aus deinen erfassten Sätzen ergeben."
        />
      ) : (
        <div className="grid gap-4">
          <section aria-label="Kennzahlen" className="grid grid-cols-2 gap-2">
            <Stat
              label="Einheiten"
              value={formatNumber(analytics.sessionCount)}
              tone="accent"
            />
            <Stat label="Trainingstage" value={formatNumber(analytics.trainingDays)} />
            <Stat
              label="Tage / Woche"
              value={formatNumber(analytics.trainingDaysPerWeek, 1)}
              hint="Durchschnitt"
            />
            <Stat
              label="Regelmäßigkeit"
              value={formatPercent(analytics.consistency)}
              hint="Wochen mit Training"
            />
            <Stat
              label="Gesamtdauer"
              value={formatDurationLong(analytics.totalDurationSeconds)}
            />
            <Stat
              label="Ø Dauer"
              value={
                analytics.averageDurationSeconds == null
                  ? '–'
                  : formatDurationLong(analytics.averageDurationSeconds)
              }
            />
            <Stat label="Arbeitssätze" value={formatNumber(analytics.workingSetCount)} />
            <Stat label="Wiederholungen" value={formatNumber(analytics.totalReps)} />
            <Stat
              label="Volumen"
              value={formatVolume(analytics.volume.volumeKg)}
              hint="nur gewichtete Übungen"
            />
            <Stat
              label="Serie"
              value={`${formatNumber(analytics.streakWeeks)} Wo.`}
              hint="Wochen in Folge"
            />
          </section>

          <ChartFrame
            title="Trainingsvolumen je Woche"
            empty={weeklyPoints.length === 0}
            summary={
              weeklyPoints.length === 0
                ? 'Keine Wochen mit gewichtetem Volumen im Zeitraum.'
                : `Wöchentliches Volumen gewichteter Übungen über ${weeklyPoints.length} Wochen. ` +
                  `Höchster Wert ${formatVolume(Math.max(...weeklyPoints.map((p) => p.value)))}, ` +
                  `zuletzt ${formatVolume(weeklyPoints[weeklyPoints.length - 1].value)}.`
            }
            table={
              <DataTable
                caption="Volumen je Woche"
                columns={['Woche', 'Volumen', 'Sätze', 'Einheiten']}
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
            title="Arbeitssätze je Muskelgruppe"
            empty={musclePoints.length === 0}
            summary={
              musclePoints.length === 0
                ? 'Keine Sätze mit zugeordneter Muskelgruppe im Zeitraum.'
                : `Direkte Arbeitssätze pro Muskelgruppe. Am meisten trainiert: ` +
                  `${musclePoints[0].label} mit ${musclePoints[0].value} Sätzen.`
            }
            table={
              <DataTable
                caption="Sätze je Muskelgruppe"
                columns={['Muskelgruppe', 'Direkt', 'Indirekt', 'Wdh.', 'Volumen']}
                rows={analytics.muscleGroups.map((group) => [
                  group.muscleGroup,
                  group.directSets,
                  group.indirectSets,
                  group.totalReps,
                  formatVolume(group.volumeKg),
                ])}
              />
            }
          >
            <HorizontalBarChart data={musclePoints} formatValue={formatNumber} />
          </ChartFrame>

          <Card>
            <CardHeader
              title="Entwicklung je Übung"
              subtitle="Wähle eine Übung und die Kennzahl, die dich interessiert."
              as="h3"
            />
            <div className="grid gap-2">
              <SelectField
                label="Übung"
                value={exerciseId}
                onChange={(event) => setExerciseId(event.target.value)}
              >
                <option value="">Bitte auswählen</option>
                {trackedExercises.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Kennzahl"
                value={metric}
                disabled={!exerciseId}
                onChange={(event) => setMetric(event.target.value as Metric)}
              >
                {availableMetrics.map((key) => (
                  <option key={key} value={key}>
                    {METRIC_LABELS[key]}
                  </option>
                ))}
              </SelectField>
            </div>

            {exerciseId ? (
              <div className="mt-3">
                <ChartFrame
                  title={`${selectedExercise?.name ?? 'Übung'} — ${METRIC_LABELS[metric]}`}
                  empty={seriesPoints.every((point) => point.value == null)}
                  summary={
                    metric === 'oneRm'
                      ? `Schätzwert nach Epley, nur für ${ONE_RM_MIN_REPS}–${ONE_RM_MAX_REPS} Wiederholungen und Übungen mit externem Gewicht. Kein Messwert.`
                      : `Verlauf über ${seriesPoints.length} Trainingseinheiten. Lücken bedeuten, dass der Wert für diese Einheit fachlich nicht berechenbar ist.`
                  }
                  table={
                    <DataTable
                      caption={`${METRIC_LABELS[metric]} je Einheit`}
                      columns={
                        isCardioExercise
                          ? ['Datum', 'Wert', 'Abschnitte']
                          : ['Datum', 'Wert', 'Sätze', 'Wdh.']
                      }
                      rows={(data?.series ?? []).map((point) =>
                        isCardioExercise
                          ? [formatDate(point.date), metricCell(point), point.workingSets]
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
                  <SimpleLineChart data={seriesPoints} formatValue={metricFormatter} />
                </ChartFrame>
                {data?.plateau ? <PlateauHint analysis={data.plateau} /> : null}
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Pausen" as="h3" />
            <div className="grid grid-cols-2 gap-2">
              <Stat
                label="Ø Pause"
                value={
                  analytics.restStatistics.averageActualSeconds == null
                    ? '–'
                    : `${Math.round(analytics.restStatistics.averageActualSeconds)} s`
                }
              />
              <Stat
                label="Ø Abweichung"
                value={formatSignedSeconds(
                  analytics.restStatistics.averageDeviationSeconds,
                )}
                hint="von der Zielpause"
              />
              <Stat
                label="Ziel erreicht"
                value={formatPercent(analytics.restStatistics.targetMetRatio)}
                hint="Anteil der Pausen"
              />
              <Stat
                label="Bewertete Pausen"
                value={formatNumber(analytics.restStatistics.evaluatedSets)}
              />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Bewertet werden nur Sätze mit Zielpause und tatsächlich erfasster Pause.
              Eine positive Abweichung bedeutet eine längere Pause als geplant.
            </p>
          </Card>

          {analytics.cardio.activities > 0 ? (
            <Card>
              <CardHeader
                title="Cardio"
                subtitle="Getrennt von Kraft ausgewertet"
                as="h3"
              />
              <div className="grid grid-cols-2 gap-2">
                <Stat
                  label="Aktivitäten"
                  value={formatNumber(analytics.cardio.activities)}
                />
                <Stat
                  label="Cardio-Dauer"
                  value={formatCardioDuration(analytics.cardio.totalDurationSeconds)}
                />
                {analytics.cardio.totalDistanceMeters > 0 ? (
                  <Stat
                    label="Distanz"
                    value={formatCardioDistance(
                      analytics.cardio.totalDistanceMeters,
                      undefined,
                    )}
                  />
                ) : null}
                {analytics.cardio.averageHeartRateBpm != null ? (
                  <Stat
                    label="Ø Herzfrequenz"
                    value={`${Math.round(analytics.cardio.averageHeartRateBpm)} bpm`}
                    hint="aufgezeichnet"
                  />
                ) : null}
                {analytics.cardio.totalCaloriesKcal > 0 ? (
                  <Stat
                    label="Kalorien"
                    value={`${formatNumber(analytics.cardio.totalCaloriesKcal)} kcal`}
                    hint="erfasst"
                  />
                ) : null}
                {analytics.cardio.totalElevationGainMeters > 0 ? (
                  <Stat
                    label="Höhenmeter"
                    value={`${formatNumber(analytics.cardio.totalElevationGainMeters)} m`}
                  />
                ) : null}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Cardio fließt nicht in Kraftvolumen, 1RM oder Arbeitssätze ein. Pace und
                Geschwindigkeit werden nur je Aktivität und Modalität ausgewertet.
              </p>

              <div className="mt-3 grid gap-4">
                <ChartFrame
                  title="Cardio-Minuten je Woche"
                  empty={cardioMinutePoints.length === 0}
                  summary={
                    cardioMinutePoints.length === 0
                      ? 'Keine Cardio-Minuten im Zeitraum.'
                      : `Cardio-Minuten über ${cardioMinutePoints.length} Wochen.`
                  }
                  table={
                    <DataTable
                      caption="Cardio-Minuten je Woche"
                      columns={['Woche', 'Minuten', 'Aktivitäten']}
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
                    title="Cardio-Distanz je Woche"
                    empty={false}
                    summary={`Distanz in km über ${cardioDistancePoints.length} Wochen. Nur Wochen mit erfasster Distanz.`}
                    table={
                      <DataTable
                        caption="Cardio-Distanz je Woche"
                        columns={['Woche', 'Distanz (km)']}
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

          <Card>
            <CardHeader title="Persönliche Bestleistungen" as="h3" />
            {analytics.personalRecords.length === 0 ? (
              <p className="text-sm text-muted">Noch keine Bestleistungen erfasst.</p>
            ) : (
              <ul className="grid gap-2">
                {analytics.personalRecords.map((record) => (
                  <li
                    key={`${record.exerciseId} ${record.equipment} ${record.weightMode}`}
                    className="border-t border-border pt-2 first:border-0 first:pt-0"
                  >
                    <p className="font-medium">
                      {record.exerciseName}
                      {record.equipment !== 'unspecified' ? (
                        <span className="font-normal text-muted">
                          {' '}
                          · {equipmentLabel(record.equipment)}
                        </span>
                      ) : null}
                    </p>
                    <p className="numeric mt-0.5 text-sm text-muted">
                      {record.bestLoadKg != null
                        ? `Bestlast ${formatKg(record.bestLoadKg)}${record.bestLoadReps ? ` × ${record.bestLoadReps}` : ''}`
                        : null}
                      {record.bestEstimatedOneRepMax != null
                        ? ` · 1RM ≈ ${formatKg(record.bestEstimatedOneRepMax)} (Schätzwert)`
                        : null}
                      {record.bestReps != null ? ` · max. ${record.bestReps} Wdh.` : null}
                      {record.bestDurationSeconds != null
                        ? ` · max. ${Math.round(record.bestDurationSeconds)} s`
                        : null}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {analytics.setsWithoutVolume > 0 ? (
            <p className="text-xs leading-relaxed text-muted">
              Hinweis zur Datenqualität: {analytics.setsWithoutVolume} Arbeitssätze im
              Zeitraum haben kein berechenbares Kilogramm-Volumen (Körpergewicht,
              unterstützte oder zeitbasierte Übungen). Sie fließen bewusst nicht in die
              Volumenzahlen ein, werden aber bei Sätzen und Wiederholungen mitgezählt.
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}
