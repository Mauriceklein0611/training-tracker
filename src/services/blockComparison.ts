import type { AnalyticsDataset } from '@/services/analytics';
import {
  buildSetContexts,
  computeAnalytics,
  filterContextsByRange,
} from '@/services/analytics';
import {
  estimatedOneRepMax,
  isCardio,
  isCompleted,
  isWorkingSet,
} from '@/services/metrics';
import type { BodyWeightEntry } from '@/types';
import { dayKey, rateWeeks, weeksInRange, type DateRange } from '@/utils/date';

/**
 * Comparison of two freely chosen training blocks.
 *
 * Each block is summarised independently from the same local data; the two
 * summaries are then presented side by side. Nothing here draws a conclusion or
 * invents a value: a metric with no data is reported as null, and per-week
 * figures are provided so blocks of different lengths can be compared fairly.
 */

export interface BlockMetrics {
  label: string;
  fromKey: string;
  toKey: string;
  /** Calendar weeks the block spans (at least 1), for per-week normalisation. */
  weeks: number;
  sessions: number;
  trainingDays: number;
  durationSeconds: number;
  workingSets: number;
  totalReps: number;
  volumeKg: number;
  distinctExercises: number;
  /** Highest estimated 1RM in the block (Epley), or null when none is valid. */
  bestEstimatedOneRepMax: number | null;
  avgRir: number | null;
  avgRpe: number | null;
  restTargetMetRatio: number | null;
  avgRestDeviationSeconds: number | null;
  avgBodyWeightKg: number | null;
  avgBodyFatPercent: number | null;
  // Per-week values, so different block lengths stay comparable.
  sessionsPerWeek: number;
  workingSetsPerWeek: number;
  volumePerWeekKg: number;
  durationPerWeekSeconds: number;
  // Cardio, kept apart from the strength metrics above (never merged).
  cardioActivities: number;
  cardioDurationSeconds: number;
  cardioDistanceMeters: number;
  cardioActivitiesPerWeek: number;
  cardioMinutesPerWeek: number;
  cardioDistancePerWeekMeters: number;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Summarises one block. Reuses the analytics engine, adding RIR/RPE and body data. */
export function computeBlockMetrics(
  dataset: AnalyticsDataset,
  bodyEntries: BodyWeightEntry[],
  range: DateRange,
  label: string,
  now: Date = new Date(),
): BlockMetrics {
  const analytics = computeAnalytics(dataset, range, { now });
  // `weeks` (calendar) is shown for the block; per-week rates divide by the
  // day span / 7 so different block lengths compare fairly (28 days → 4).
  const weeks = weeksInRange(range);
  const perWeekDivisor = rateWeeks(range);

  const contexts = filterContextsByRange(buildSetContexts(dataset), range).filter(
    (context) =>
      isCompleted(context.set) &&
      isWorkingSet(context.set) &&
      !isCardio(context.set, context.sessionExercise),
  );
  const rirValues = contexts
    .map((context) => context.set.rir)
    .filter((value): value is number => value != null);
  const rpeValues = contexts
    .map((context) => context.set.rpe)
    .filter((value): value is number => value != null);
  const distinctExercises = new Set(
    contexts.map((context) => context.sessionExercise.exerciseId),
  ).size;
  // Best estimated 1RM in the block (Epley, weighted 1–12 rep sets only), so a
  // strength comparison can show peak estimated strength side by side.
  const oneRmValues = contexts
    .map((context) => estimatedOneRepMax(context.set, context.sessionExercise))
    .filter((value): value is number => value != null);
  const bestEstimatedOneRepMax = oneRmValues.length > 0 ? Math.max(...oneRmValues) : null;

  const fromKey = dayKey(range.from);
  const toKey = dayKey(range.to);
  const bodyInRange = bodyEntries.filter(
    (entry) => entry.date >= fromKey && entry.date <= toKey,
  );
  const avgBodyWeightKg = average(
    bodyInRange
      .map((entry) => entry.weightKg)
      .filter((value): value is number => value != null),
  );
  const avgBodyFatPercent = average(
    bodyInRange
      .map((entry) => entry.bodyFatPercent)
      .filter((value): value is number => value != null),
  );

  return {
    label,
    fromKey,
    toKey,
    weeks,
    sessions: analytics.sessionCount,
    trainingDays: analytics.trainingDays,
    durationSeconds: analytics.totalDurationSeconds,
    workingSets: analytics.workingSetCount,
    totalReps: analytics.totalReps,
    volumeKg: analytics.volume.volumeKg,
    distinctExercises,
    bestEstimatedOneRepMax,
    avgRir: average(rirValues),
    avgRpe: average(rpeValues),
    restTargetMetRatio: analytics.restStatistics.targetMetRatio,
    avgRestDeviationSeconds: analytics.restStatistics.averageDeviationSeconds,
    avgBodyWeightKg,
    avgBodyFatPercent,
    sessionsPerWeek: analytics.sessionCount / perWeekDivisor,
    workingSetsPerWeek: analytics.workingSetCount / perWeekDivisor,
    volumePerWeekKg: analytics.volume.volumeKg / perWeekDivisor,
    durationPerWeekSeconds: analytics.totalDurationSeconds / perWeekDivisor,
    cardioActivities: analytics.cardio.activities,
    cardioDurationSeconds: analytics.cardio.totalDurationSeconds,
    cardioDistanceMeters: analytics.cardio.totalDistanceMeters,
    cardioActivitiesPerWeek: analytics.cardio.activities / perWeekDivisor,
    cardioMinutesPerWeek: analytics.cardio.totalDurationSeconds / 60 / perWeekDivisor,
    cardioDistancePerWeekMeters: analytics.cardio.totalDistanceMeters / perWeekDivisor,
  };
}

export interface BlockComparison {
  a: BlockMetrics;
  b: BlockMetrics;
}

export function compareBlocks(
  dataset: AnalyticsDataset,
  bodyEntries: BodyWeightEntry[],
  rangeA: DateRange,
  rangeB: DateRange,
  labels: { a: string; b: string } = { a: 'Block A', b: 'Block B' },
  now: Date = new Date(),
): BlockComparison {
  return {
    a: computeBlockMetrics(dataset, bodyEntries, rangeA, labels.a, now),
    b: computeBlockMetrics(dataset, bodyEntries, rangeB, labels.b, now),
  };
}

/**
 * A self-describing comparison object for the AI export. States both blocks and
 * a plain difference (b − a) per metric; never a percentage judgement or a
 * conclusion, and missing values stay null.
 */
export function buildBlockComparisonExport(
  comparison: BlockComparison,
): Record<string, unknown> {
  const round = (value: number | null, digits = 2): number | null =>
    value == null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));

  const diff = (a: number | null, b: number | null): number | null =>
    a == null || b == null ? null : Number((b - a).toFixed(2));

  const block = (metrics: BlockMetrics) => ({
    label: metrics.label,
    from: metrics.fromKey,
    to: metrics.toKey,
    weeks: metrics.weeks,
    absolute: {
      sessions: metrics.sessions,
      trainingDays: metrics.trainingDays,
      durationMinutes: round(metrics.durationSeconds / 60, 1),
      workingSets: metrics.workingSets,
      totalReps: metrics.totalReps,
      volumeKg: round(metrics.volumeKg),
      distinctExercises: metrics.distinctExercises,
      bestEstimatedOneRepMaxKg: round(metrics.bestEstimatedOneRepMax),
    },
    perWeek: {
      sessions: round(metrics.sessionsPerWeek),
      workingSets: round(metrics.workingSetsPerWeek),
      volumeKg: round(metrics.volumePerWeekKg),
      durationMinutes: round(metrics.durationPerWeekSeconds / 60, 1),
    },
    // Cardio is a separate section — never added to the strength figures above.
    cardio: {
      activities: metrics.cardioActivities,
      durationMinutes: round(metrics.cardioDurationSeconds / 60, 1),
      distanceMeters: round(metrics.cardioDistanceMeters, 0),
      perWeek: {
        activities: round(metrics.cardioActivitiesPerWeek),
        minutes: round(metrics.cardioMinutesPerWeek, 1),
        distanceMeters: round(metrics.cardioDistancePerWeekMeters, 0),
      },
    },
    averages: {
      rir: round(metrics.avgRir),
      rpe: round(metrics.avgRpe),
      restTargetMetRatio: round(metrics.restTargetMetRatio, 3),
      restDeviationSeconds: round(metrics.avgRestDeviationSeconds, 1),
      bodyWeightKg: round(metrics.avgBodyWeightKg),
      bodyFatPercent: round(metrics.avgBodyFatPercent),
    },
  });

  return {
    note:
      'Zwei vom Nutzer gewählte Zeiträume, jeweils eigenständig aus den lokalen Daten ' +
      'berechnet. perWeek normalisiert unterschiedlich lange Blöcke. Fehlende Werte sind ' +
      'null und dürfen nicht geschätzt werden. differencePerWeek ist b − a und ist eine ' +
      'reine Rechengröße, keine Bewertung.',
    blockA: block(comparison.a),
    blockB: block(comparison.b),
    differencePerWeek: {
      sessions: diff(comparison.a.sessionsPerWeek, comparison.b.sessionsPerWeek),
      workingSets: diff(comparison.a.workingSetsPerWeek, comparison.b.workingSetsPerWeek),
      volumeKg: diff(comparison.a.volumePerWeekKg, comparison.b.volumePerWeekKg),
    },
  };
}
