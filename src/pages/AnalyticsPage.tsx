import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
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
import {
  computeAnalytics,
  computeExerciseSeries,
  listTrackedExercises,
} from '@/services/analytics';
import { ONE_RM_MAX_REPS, ONE_RM_MIN_REPS } from '@/services/metrics';
import { useSettings } from '@/hooks/useSettings';
import type { AnalyticsRangeKey } from '@/types';
import { customRange, formatDate, formatDurationLong, lastDaysRange } from '@/utils/date';
import {
  formatKg,
  formatNumber,
  formatPercent,
  formatSignedSeconds,
  formatVolume,
} from '@/utils/format';

const RANGE_OPTIONS: { value: AnalyticsRangeKey; label: string }[] = [
  { value: '7d', label: '7 T.' },
  { value: '30d', label: '30 T.' },
  { value: '90d', label: '90 T.' },
  { value: 'all', label: 'Gesamt' },
  { value: 'custom', label: 'Eigen' },
];

type Metric = 'volume' | 'topSet' | 'oneRm' | 'reps' | 'duration';

const METRIC_LABELS: Record<Metric, string> = {
  volume: 'Volumen je Einheit',
  topSet: 'Schwerster Satz (Gesamtlast)',
  oneRm: 'Geschätztes 1RM (Schätzwert)',
  reps: 'Wiederholungen je Einheit',
  duration: 'Längster Zeitsatz',
};

export default function AnalyticsPage() {
  const { settings } = useSettings();
  const [rangeKey, setRangeKey] = useState<AnalyticsRangeKey>(settings.defaultAnalyticsRange);
  const [customFrom, setCustomFrom] = useState(
    () => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
  );
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [exerciseId, setExerciseId] = useState('');
  const [metric, setMetric] = useState<Metric>('volume');

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
    const dataset = await loadAnalyticsDataset();
    return {
      analytics: computeAnalytics(dataset, range),
      exercises: listTrackedExercises(dataset),
      series: exerciseId ? computeExerciseSeries(dataset, exerciseId, range) : [],
    };
  }, [range, exerciseId]);

  const analytics = data?.analytics;
  const trackedExercises = data?.exercises ?? [];
  const selectedExercise = trackedExercises.find((entry) => entry.id === exerciseId);

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
                : point.maxDurationSeconds;
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
    return formatKg(value);
  };

  const hasData = (analytics?.sessionCount ?? 0) > 0;

  return (
    <>
      <PageHeader title="Analyse" subtitle="Berechnet ausschließlich aus deinen lokalen Daten" />

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
            <Stat label="Einheiten" value={formatNumber(analytics.sessionCount)} tone="accent" />
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
                {(Object.keys(METRIC_LABELS) as Metric[]).map((key) => (
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
                      columns={['Datum', 'Wert', 'Sätze', 'Wdh.']}
                      rows={(data?.series ?? []).map((point) => [
                        formatDate(point.date),
                        metric === 'volume'
                          ? formatVolume(point.volumeKg)
                          : metric === 'topSet'
                            ? formatKg(point.topSetLoadKg)
                            : metric === 'oneRm'
                              ? formatKg(point.estimatedOneRepMax)
                              : metric === 'reps'
                                ? formatNumber(point.totalReps)
                                : point.maxDurationSeconds == null
                                  ? '–'
                                  : `${formatNumber(point.maxDurationSeconds)} s`,
                        point.workingSets,
                        point.totalReps,
                      ])}
                    />
                  }
                >
                  <SimpleLineChart data={seriesPoints} formatValue={metricFormatter} />
                </ChartFrame>
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
                value={formatSignedSeconds(analytics.restStatistics.averageDeviationSeconds)}
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
              Bewertet werden nur Sätze mit Zielpause und tatsächlich erfasster Pause. Eine
              positive Abweichung bedeutet eine längere Pause als geplant.
            </p>
          </Card>

          <Card>
            <CardHeader title="Persönliche Bestleistungen" as="h3" />
            {analytics.personalRecords.length === 0 ? (
              <p className="text-sm text-muted">Noch keine Bestleistungen erfasst.</p>
            ) : (
              <ul className="grid gap-2">
                {analytics.personalRecords.map((record) => (
                  <li key={record.exerciseId} className="border-t border-border pt-2 first:border-0 first:pt-0">
                    <p className="font-medium">{record.exerciseName}</p>
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
              Hinweis zur Datenqualität: {analytics.setsWithoutVolume} Arbeitssätze im Zeitraum
              haben kein berechenbares Kilogramm-Volumen (Körpergewicht, unterstützte oder
              zeitbasierte Übungen). Sie fließen bewusst nicht in die Volumenzahlen ein, werden
              aber bei Sätzen und Wiederholungen mitgezählt.
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}
