import type { WorkoutSet } from '@/types';

/**
 * Rest period logic.
 *
 * The timer is *always* derived from the absolute `restStartedAt` timestamp and
 * the current clock — never from a counter ticking in React state. That is what
 * makes it survive a locked screen, a backgrounded tab or a full page reload.
 */

export interface RestProgress {
  /** A rest period is running (started, not yet ended). */
  running: boolean;
  /** Seconds since the set was completed. */
  elapsedSeconds: number;
  /** Seconds left until the target; 0 once the target is reached. */
  remainingSeconds: number;
  /** Seconds beyond the target; 0 while still counting down. */
  overtimeSeconds: number;
  /** True as soon as the target rest time has been reached. */
  targetReached: boolean;
  targetSeconds: number;
}

export function computeRestProgress(
  set: Pick<WorkoutSet, 'restStartedAt' | 'restEndedAt' | 'restTargetSeconds'> | undefined | null,
  now: Date = new Date(),
): RestProgress {
  const targetSeconds = set?.restTargetSeconds ?? 0;
  const idle: RestProgress = {
    running: false,
    elapsedSeconds: 0,
    remainingSeconds: targetSeconds,
    overtimeSeconds: 0,
    targetReached: false,
    targetSeconds,
  };
  if (!set?.restStartedAt || set.restEndedAt) return idle;

  const startedAt = new Date(set.restStartedAt).getTime();
  if (Number.isNaN(startedAt)) return idle;

  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - startedAt) / 1000));
  const remainingSeconds = Math.max(0, targetSeconds - elapsedSeconds);
  const overtimeSeconds = Math.max(0, elapsedSeconds - targetSeconds);

  return {
    running: true,
    elapsedSeconds,
    remainingSeconds,
    overtimeSeconds,
    targetReached: targetSeconds > 0 && elapsedSeconds >= targetSeconds,
    targetSeconds,
  };
}

/** Actual minus target rest, in seconds. Negative means the rest was too short. */
export function restDeviationSeconds(set: WorkoutSet): number | null {
  if (set.restActualSeconds == null || set.restTargetSeconds <= 0) return null;
  return set.restActualSeconds - set.restTargetSeconds;
}

export function restTargetMet(set: WorkoutSet): boolean | null {
  const deviation = restDeviationSeconds(set);
  if (deviation == null) return null;
  return deviation >= 0;
}

export interface RestStatistics {
  /** Sets that had both a target and a recorded actual rest. */
  evaluatedSets: number;
  averageActualSeconds: number | null;
  averageTargetSeconds: number | null;
  /** Mean of (actual − target). Positive = rested longer than planned. */
  averageDeviationSeconds: number | null;
  /** Share of rests that reached at least the target, 0..1. */
  targetMetRatio: number | null;
}

export function emptyRestStatistics(): RestStatistics {
  return {
    evaluatedSets: 0,
    averageActualSeconds: null,
    averageTargetSeconds: null,
    averageDeviationSeconds: null,
    targetMetRatio: null,
  };
}

/**
 * Aggregates rest behaviour over a set of workouts.
 * Sets without a target rest time are ignored: there is nothing to compare to.
 */
export function computeRestStatistics(sets: WorkoutSet[]): RestStatistics {
  const evaluated = sets.filter(
    (set) => set.restActualSeconds != null && set.restTargetSeconds > 0,
  );
  if (evaluated.length === 0) return emptyRestStatistics();

  const totalActual = evaluated.reduce((sum, set) => sum + (set.restActualSeconds ?? 0), 0);
  const totalTarget = evaluated.reduce((sum, set) => sum + set.restTargetSeconds, 0);
  const met = evaluated.filter((set) => restTargetMet(set) === true).length;

  return {
    evaluatedSets: evaluated.length,
    averageActualSeconds: totalActual / evaluated.length,
    averageTargetSeconds: totalTarget / evaluated.length,
    averageDeviationSeconds: (totalActual - totalTarget) / evaluated.length,
    targetMetRatio: met / evaluated.length,
  };
}
