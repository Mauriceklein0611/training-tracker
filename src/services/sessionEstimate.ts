/**
 * Rough estimate of how long a workout unit takes, from its planned exercises.
 *
 * A deliberate approximation for the "Als Nächstes" hero — never presented as
 * exact. Each exercise contributes its sets × (work + rest); a time-based set
 * uses its target duration, everything else a nominal work window.
 */
export interface EstimateExercise {
  targetSets?: number;
  restSeconds?: number;
  targetDurationSeconds?: number;
}

const NOMINAL_WORK_SECONDS = 40;
const DEFAULT_SETS = 3;
const DEFAULT_REST_SECONDS = 90;

export function estimateUnitMinutes(exercises: EstimateExercise[]): number {
  let seconds = 0;
  for (const exercise of exercises) {
    const sets = exercise.targetSets ?? DEFAULT_SETS;
    const work = exercise.targetDurationSeconds ?? NOMINAL_WORK_SECONDS;
    const rest = exercise.restSeconds ?? DEFAULT_REST_SECONDS;
    seconds += sets * (work + rest);
  }
  return Math.round(seconds / 60);
}
