import type { ExerciseSeriesPoint } from '@/services/analytics';
import type { TrackingType } from '@/types';

/**
 * Local, explainable plateau hints.
 *
 * These are deliberately conservative descriptive functions, not a diagnosis:
 * they only ever say that a chosen number stayed roughly flat over a handful of
 * recent, comparable sessions, and they refuse to say anything at all when the
 * data is too sparse or too noisy to support even that.
 */

/** Fewest comparable sessions before any statement is made. */
export const MIN_SESSIONS_FOR_PLATEAU = 4;
/** Most recent sessions considered for the window. */
export const MAX_PLATEAU_WINDOW = 6;
/** Relative gain (2 %) below which we treat performance as "not improved". */
export const PLATEAU_TOLERANCE = 0.02;
/** Relative drop (5 %) below the baseline that counts as a decline, not a plateau. */
export const REGRESS_TOLERANCE = 0.05;
/**
 * Relative spread of the window above which the data is considered too
 * inconsistent to judge, so no statement is made.
 */
export const MAX_RELATIVE_SPREAD = 0.4;

export type PlateauMetric = 'oneRepMax' | 'topSetLoad' | 'reps' | 'duration';
export type PlateauStatus = 'plateau' | 'progress' | 'regress' | 'insufficient' | 'inconsistent';

export const PLATEAU_METRIC_LABELS: Record<PlateauMetric, string> = {
  oneRepMax: 'die geschätzte Leistung (1RM-Schätzwert)',
  topSetLoad: 'das Gewicht des schwersten Satzes',
  reps: 'die beste Wiederholungszahl',
  duration: 'die längste Haltedauer',
};

export interface PlateauAnalysis {
  status: PlateauStatus;
  metric: PlateauMetric | null;
  metricLabel: string | null;
  /** Comparable sessions available in total. */
  comparableSessions: number;
  /** Sessions actually looked at (the window). */
  windowSize: number;
  fromDate: string | null;
  toDate: string | null;
  baseline: number | null;
  latest: number | null;
  best: number | null;
  /** Best vs. baseline, in percent (rounded to one decimal). */
  changePercent: number | null;
}

interface Sample {
  date: string;
  value: number;
}

function metricValue(point: ExerciseSeriesPoint, metric: PlateauMetric): number | null {
  switch (metric) {
    case 'oneRepMax':
      return point.estimatedOneRepMax;
    case 'topSetLoad':
      return point.topSetLoadKg;
    case 'reps':
      return point.bestReps;
    case 'duration':
      return point.maxDurationSeconds;
  }
}

function samplesFor(points: ExerciseSeriesPoint[], metric: PlateauMetric): Sample[] {
  return points
    .map((point) => ({ date: point.date, value: metricValue(point, metric) }))
    .filter((sample): sample is Sample => sample.value != null && Number.isFinite(sample.value));
}

/**
 * Picks the most meaningful metric for the exercise's tracking type, preferring
 * the estimated 1RM for weighted movements and falling back to reps or duration
 * where a kilogram figure is not meaningful. Returns null when no metric has
 * enough comparable sessions.
 */
function pickMetric(
  points: ExerciseSeriesPoint[],
  trackingType: TrackingType,
): PlateauMetric | null {
  const enough = (metric: PlateauMetric) =>
    samplesFor(points, metric).length >= MIN_SESSIONS_FOR_PLATEAU;

  if (trackingType === 'duration') return enough('duration') ? 'duration' : null;

  // Weighted or added-weight work: the estimated 1RM is the best single signal.
  if (enough('oneRepMax')) return 'oneRepMax';
  if (enough('reps')) return 'reps';
  if (enough('topSetLoad')) return 'topSetLoad';
  return null;
}

function insufficient(reason: PlateauStatus = 'insufficient'): PlateauAnalysis {
  return {
    status: reason,
    metric: null,
    metricLabel: null,
    comparableSessions: 0,
    windowSize: 0,
    fromDate: null,
    toDate: null,
    baseline: null,
    latest: null,
    best: null,
    changePercent: null,
  };
}

/**
 * Analyses the recent trend of an exercise for a plateau.
 *
 * `points` are the per-session series (chronological, oldest first) as produced
 * by {@link computeExerciseSeries} — ideally over the full history, so "recent"
 * really means the latest sessions.
 */
export function analyzePlateau(
  points: ExerciseSeriesPoint[],
  trackingType: TrackingType,
): PlateauAnalysis {
  const metric = pickMetric(points, trackingType);
  if (!metric) return insufficient('insufficient');

  const samples = samplesFor(points, metric);
  if (samples.length < MIN_SESSIONS_FOR_PLATEAU) return insufficient('insufficient');

  const window = samples.slice(-Math.min(MAX_PLATEAU_WINDOW, samples.length));
  const values = window.map((sample) => sample.value);
  const baseline = values[0];
  const latest = values[values.length - 1];
  const best = Math.max(...values);
  const min = Math.min(...values);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;

  const base = {
    metric,
    metricLabel: PLATEAU_METRIC_LABELS[metric],
    comparableSessions: samples.length,
    windowSize: window.length,
    fromDate: window[0].date,
    toDate: window[window.length - 1].date,
    baseline,
    latest,
    best,
    changePercent: baseline > 0 ? Math.round(((best - baseline) / baseline) * 1000) / 10 : null,
  };

  // Too noisy to make any claim about a trend.
  if (mean > 0 && (best - min) / mean > MAX_RELATIVE_SPREAD) {
    return { ...base, status: 'inconsistent' };
  }

  const gain = baseline > 0 ? (best - baseline) / baseline : 0;
  const latestChange = baseline > 0 ? (latest - baseline) / baseline : 0;

  let status: PlateauStatus;
  if (gain > PLATEAU_TOLERANCE) status = 'progress';
  else if (latestChange < -REGRESS_TOLERANCE) status = 'regress';
  else status = 'plateau';

  return { ...base, status };
}

/**
 * Human-readable lines for a plateau analysis, or an empty array when there is
 * nothing worth surfacing (progress, or not enough consistent data). Always
 * ends with the same honest caveat about what the data cannot capture.
 */
export function plateauMessages(analysis: PlateauAnalysis): string[] {
  if (analysis.status !== 'plateau' && analysis.status !== 'regress') return [];

  const caveat =
    'Das ist nur ein Hinweis – Schlaf, Technik, Tagesform und Ausführung sind nicht ' +
    'vollständig erfasst.';

  if (analysis.status === 'regress') {
    return [
      `In den letzten ${analysis.windowSize} vergleichbaren Einheiten ist ${analysis.metricLabel} ` +
        'eher zurückgegangen als gestiegen.',
      caveat,
    ];
  }

  return [
    `In den letzten ${analysis.windowSize} vergleichbaren Einheiten blieb ${analysis.metricLabel} ` +
      'ungefähr gleich.',
    caveat,
  ];
}
