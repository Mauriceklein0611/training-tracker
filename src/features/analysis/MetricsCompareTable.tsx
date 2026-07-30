import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { BlockMetrics } from '@/services/blockComparison';
import {
  formatKg,
  formatNumber,
  formatPercent,
  formatPercentValue,
  formatSignedSeconds,
  formatVolume,
} from '@/utils/format';
import { formatCardioDistance, formatPace } from '@/services/cardioMetrics';
import { formatDurationLong } from '@/utils/date';
import { cn } from '@/utils/cn';

/**
 * One comparison metric. `a`/`b` are the raw numbers (null = no data, shown
 * honestly rather than as zero); `format` renders a value. A delta (b − a) is
 * shown only when both sides have a value and `delta` is not disabled — never an
 * estimate or a judgement.
 */
interface MetricRow {
  label: string;
  a: number | null;
  b: number | null;
  format: (value: number) => string;
  delta?: boolean;
}

/** Signed b − a in the row's own unit, following the ±/+/− house convention. */
function formatDelta(row: MetricRow): string | null {
  if (row.delta === false || row.a == null || row.b == null) return null;
  const d = row.b - row.a;
  if (Math.abs(d) < 1e-9) return `±${row.format(0)}`;
  return `${d > 0 ? '+' : '−'}${row.format(Math.abs(d))}`;
}

/** One value in a row: a small caption (mobile only) above the right-aligned value. */
function Cell({
  caption,
  text,
  muted,
}: {
  caption: string;
  text: string;
  muted?: boolean;
}) {
  return (
    <span className="flex flex-col sm:block sm:text-right">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted sm:hidden">
        {caption}
      </span>
      <span className={cn('numeric text-sm font-medium', muted && 'text-muted')}>
        {text}
      </span>
    </span>
  );
}

/** The 4-column grid template shared by the header and every row (sm and up). */
const GRID = 'sm:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))]';

function Row({ row }: { row: MetricRow }) {
  const { t } = useTranslation('comparisons');
  const aText = row.a == null ? t('metrics.noData') : row.format(row.a);
  const bText = row.b == null ? t('metrics.noData') : row.format(row.b);
  const delta = formatDelta(row);
  return (
    <div className="border-t border-border py-2 first:border-0">
      {/* Mobile: the metric name on its own line above the A/B/Δ columns. */}
      <div className="mb-1 text-sm text-muted sm:hidden">{row.label}</div>
      <div className={cn('grid grid-cols-3 gap-2 sm:items-baseline', GRID)}>
        <span className="hidden text-sm text-muted sm:block">{row.label}</span>
        <Cell caption="A" text={aText} />
        <Cell caption="B" text={bText} />
        <Cell caption="Δ" text={delta ?? '–'} muted />
      </div>
    </div>
  );
}

function Section({ title, rows }: { title: string; rows: MetricRow[] }) {
  return (
    <div className="mt-3">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h3>
      {rows.map((row) => (
        <Row key={row.label} row={row} />
      ))}
    </div>
  );
}

/** Distance for a cardio total: null (→ "keine Daten") when nothing was recorded. */
function distanceOrNull(meters: number): number | null {
  return meters > 0 ? meters : null;
}

/**
 * Aggregate pace (min/km) from the totals, not an unweighted mean of per-set
 * paces. Null unless both totals are positive, so a division never yields NaN
 * or Infinity.
 */
function aggregatePaceMinPerKm(
  durationSeconds: number,
  distanceMeters: number,
): number | null {
  if (!(durationSeconds > 0) || !(distanceMeters > 0)) return null;
  return durationSeconds / 60 / (distanceMeters / 1000);
}

/** Aggregate speed (km/h) from the totals; null unless both are positive. */
function aggregateSpeedKmH(
  durationSeconds: number,
  distanceMeters: number,
): number | null {
  if (!(durationSeconds > 0) || !(distanceMeters > 0)) return null;
  return distanceMeters / 1000 / (durationSeconds / 3600);
}

/**
 * Side-by-side metrics shared by the block, plan and workout-unit comparison
 * screens. Purely presentational: it renders the two already-computed
 * {@link BlockMetrics}, a plain b − a delta where comparable, and never
 * estimates a missing value or draws a conclusion. Responsive — on a phone each
 * metric stacks into an A/B/Δ card instead of a squeezed three-column table.
 */
export function MetricsCompareTable({
  a,
  b,
  labelA = 'A',
  labelB = 'B',
  subA,
  subB,
}: {
  a: BlockMetrics;
  b: BlockMetrics;
  labelA?: string;
  labelB?: string;
  subA?: ReactNode;
  subB?: ReactNode;
}) {
  const { t } = useTranslation('comparisons');
  const kg = formatVolume;
  const n =
    (digits = 0) =>
    (value: number) =>
      formatNumber(value, digits);

  const absolute: MetricRow[] = [
    { label: t('metrics.rows.sessions'), a: a.sessions, b: b.sessions, format: n() },
    {
      label: t('metrics.rows.trainingDays'),
      a: a.trainingDays,
      b: b.trainingDays,
      format: n(),
    },
    {
      label: t('metrics.rows.totalDuration'),
      a: a.durationSeconds,
      b: b.durationSeconds,
      format: formatDurationLong,
    },
    {
      label: t('metrics.rows.workingSets'),
      a: a.workingSets,
      b: b.workingSets,
      format: n(),
    },
    {
      label: t('metrics.rows.repetitions'),
      a: a.totalReps,
      b: b.totalReps,
      format: n(),
    },
    { label: t('metrics.rows.volume'), a: a.volumeKg, b: b.volumeKg, format: kg },
    {
      label: t('metrics.rows.distinctExercises'),
      a: a.distinctExercises,
      b: b.distinctExercises,
      format: n(),
    },
    {
      label: t('metrics.rows.bestE1rm'),
      a: a.bestEstimatedOneRepMax,
      b: b.bestEstimatedOneRepMax,
      format: (value) => formatKg(value),
    },
  ];

  const perWeek: MetricRow[] = [
    {
      label: t('metrics.rows.sessionsPerWeek'),
      a: a.sessionsPerWeek,
      b: b.sessionsPerWeek,
      format: n(1),
    },
    {
      label: t('metrics.rows.setsPerWeek'),
      a: a.workingSetsPerWeek,
      b: b.workingSetsPerWeek,
      format: n(1),
    },
    {
      label: t('metrics.rows.volumePerWeek'),
      a: a.volumePerWeekKg,
      b: b.volumePerWeekKg,
      format: kg,
    },
    {
      label: t('metrics.rows.durationPerWeek'),
      a: a.durationPerWeekSeconds,
      b: b.durationPerWeekSeconds,
      format: formatDurationLong,
    },
  ];

  const distance = (m: number) => formatCardioDistance(m, undefined);
  const hasCardio = a.cardioActivities > 0 || b.cardioActivities > 0;
  const cardio: MetricRow[] = [
    {
      label: t('metrics.rows.sessions'),
      a: a.cardioActivities,
      b: b.cardioActivities,
      format: n(),
    },
    {
      label: t('metrics.rows.totalDuration'),
      a: a.cardioDurationSeconds,
      b: b.cardioDurationSeconds,
      format: formatDurationLong,
    },
    {
      label: t('metrics.rows.totalDistance'),
      a: distanceOrNull(a.cardioDistanceMeters),
      b: distanceOrNull(b.cardioDistanceMeters),
      format: distance,
    },
    {
      label: t('metrics.rows.averageDuration'),
      a: a.cardioActivities > 0 ? a.cardioDurationSeconds / a.cardioActivities : null,
      b: b.cardioActivities > 0 ? b.cardioDurationSeconds / b.cardioActivities : null,
      format: formatDurationLong,
    },
    {
      label: t('metrics.rows.averageDistance'),
      a:
        a.cardioActivities > 0 && a.cardioDistanceMeters > 0
          ? a.cardioDistanceMeters / a.cardioActivities
          : null,
      b:
        b.cardioActivities > 0 && b.cardioDistanceMeters > 0
          ? b.cardioDistanceMeters / b.cardioActivities
          : null,
      format: distance,
    },
    {
      label: t('metrics.rows.averagePace'),
      a: aggregatePaceMinPerKm(a.cardioDurationSeconds, a.cardioDistanceMeters),
      b: aggregatePaceMinPerKm(b.cardioDurationSeconds, b.cardioDistanceMeters),
      format: (value) => formatPace({ kind: 'min_per_km', value }),
    },
    {
      label: t('metrics.rows.averageSpeed'),
      a: aggregateSpeedKmH(a.cardioDurationSeconds, a.cardioDistanceMeters),
      b: aggregateSpeedKmH(b.cardioDurationSeconds, b.cardioDistanceMeters),
      format: (value) => formatPace({ kind: 'km_per_h', value }),
    },
    {
      label: t('metrics.rows.averageCardioRpe'),
      a: a.cardioAvgRpe,
      b: b.cardioAvgRpe,
      format: n(1),
    },
    {
      label: t('metrics.rows.sessionsPerWeek'),
      a: a.cardioActivitiesPerWeek,
      b: b.cardioActivitiesPerWeek,
      format: n(1),
    },
    {
      label: t('metrics.rows.minutesPerWeek'),
      a: a.cardioMinutesPerWeek,
      b: b.cardioMinutesPerWeek,
      format: (value) => `${formatNumber(value, 0)} min`,
    },
    {
      label: t('metrics.rows.distancePerWeek'),
      a: distanceOrNull(a.cardioDistancePerWeekMeters),
      b: distanceOrNull(b.cardioDistancePerWeekMeters),
      format: distance,
    },
  ];

  const averages: MetricRow[] = [
    { label: t('metrics.rows.averageRir'), a: a.avgRir, b: b.avgRir, format: n(1) },
    { label: t('metrics.rows.averageRpe'), a: a.avgRpe, b: b.avgRpe, format: n(1) },
    {
      label: t('metrics.rows.restTargetMet'),
      a: a.restTargetMetRatio,
      b: b.restTargetMetRatio,
      format: formatPercent,
    },
    {
      label: t('metrics.rows.averageRestDeviation'),
      a: a.avgRestDeviationSeconds,
      b: b.avgRestDeviationSeconds,
      // Already a signed value; a delta of a signed deviation would mislead.
      format: formatSignedSeconds,
      delta: false,
    },
    {
      label: t('metrics.rows.averageBodyWeight'),
      a: a.avgBodyWeightKg,
      b: b.avgBodyWeightKg,
      format: (v) => formatKg(v),
    },
    {
      label: t('metrics.rows.averageBodyFat'),
      a: a.avgBodyFatPercent,
      b: b.avgBodyFatPercent,
      format: formatPercentValue,
    },
  ];

  const head = (label: string, sub?: ReactNode) => (
    <span className="text-right font-semibold text-accent">
      {label}
      {sub ? (
        <>
          <br />
          <span className="font-normal text-muted">{sub}</span>
        </>
      ) : null}
    </span>
  );

  return (
    <div>
      {/* Mobile legend: which side is A and which is B (with their ranges). */}
      <div className="mb-2 grid grid-cols-2 gap-2 sm:hidden">
        <div className="rounded-lg bg-surface-2 px-2 py-1 text-xs">
          <span className="font-semibold text-accent">A · {labelA}</span>
          {subA ? <div className="text-muted">{subA}</div> : null}
        </div>
        <div className="rounded-lg bg-surface-2 px-2 py-1 text-xs">
          <span className="font-semibold text-accent">B · {labelB}</span>
          {subB ? <div className="text-muted">{subB}</div> : null}
        </div>
      </div>

      {/* Desktop header row aligned with the metric grid. */}
      <div className={cn('hidden gap-2 text-xs sm:grid', GRID)}>
        <span />
        {head(labelA, subA)}
        {head(labelB, subB)}
        <span className="text-right font-semibold text-muted">Δ</span>
      </div>

      <Section title={t('metrics.sections.absolute')} rows={absolute} />
      <Section title={t('metrics.sections.perWeek')} rows={perWeek} />
      {hasCardio ? <Section title={t('metrics.sections.cardio')} rows={cardio} /> : null}
      <Section title={t('metrics.sections.averages')} rows={averages} />

      <p className="mt-3 text-xs leading-relaxed text-muted">
        {t('metrics.explanation')}
      </p>
    </div>
  );
}
