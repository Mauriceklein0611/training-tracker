import type { ExerciseSeriesPoint } from '@/services/analytics';

/**
 * Pure summary of one exercise's history for its detail page. Derives only from
 * the per-session series (itself computed from raw sets), so it never invents a
 * value: a metric with no data stays null, and "best" is the maximum actually
 * recorded, evaluated with each set's own convention upstream.
 */
export interface ExerciseHistorySummary {
  sessionCount: number;
  /** Highest estimated 1RM ever recorded (Epley), or null. */
  bestE1rm: number | null;
  /** Heaviest top-set total load, and the reps it was done for. */
  bestLoadKg: number | null;
  bestLoadReps: number | null;
  /** The most recent session point, or null when there is no history. */
  last: ExerciseSeriesPoint | null;
  /** Up to five most recent session points, newest first. */
  recent: ExerciseSeriesPoint[];
}

export function summarizeExerciseHistory(
  series: ExerciseSeriesPoint[],
): ExerciseHistorySummary {
  let bestE1rm: number | null = null;
  let bestLoadKg: number | null = null;
  let bestLoadReps: number | null = null;

  for (const point of series) {
    if (point.estimatedOneRepMax != null) {
      bestE1rm =
        bestE1rm == null
          ? point.estimatedOneRepMax
          : Math.max(bestE1rm, point.estimatedOneRepMax);
    }
    if (
      point.topSetLoadKg != null &&
      (bestLoadKg == null || point.topSetLoadKg > bestLoadKg)
    ) {
      bestLoadKg = point.topSetLoadKg;
      bestLoadReps = point.topSetReps;
    }
  }

  return {
    sessionCount: series.length,
    bestE1rm,
    bestLoadKg,
    bestLoadReps,
    last: series.length > 0 ? series[series.length - 1] : null,
    recent: series.slice(-5).reverse(),
  };
}
