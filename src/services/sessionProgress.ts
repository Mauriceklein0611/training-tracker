import type { ISODateTime, WorkoutSet } from '@/types';

/**
 * Progress of a running workout, as completed exercises out of the total.
 *
 * Pure and derived only from the stored sets, so it is correct after a reload.
 * An exercise counts as done when its working-set goal is reached; without a
 * goal, a single completed set is enough. Warm-ups never count towards the goal.
 * An exercise the user finished by hand (`finishedAt`, schema 31) counts as done
 * as well — the missing sets stay missing, only the progress reflects that the
 * user is finished with it.
 */
export interface WorkoutProgressEntry {
  targetSets?: number;
  /** Set when the user ended this exercise before reaching the set goal. */
  finishedAt?: ISODateTime;
  sets: Pick<WorkoutSet, 'completedAt' | 'setType'>[];
}

export interface WorkoutProgress {
  doneExercises: number;
  totalExercises: number;
}

export function workoutProgress(entries: WorkoutProgressEntry[]): WorkoutProgress {
  const doneExercises = entries.filter((entry) => {
    if (entry.finishedAt) return true;
    const completedWorking = entry.sets.filter(
      (set) => set.completedAt && set.setType !== 'warmup',
    ).length;
    if (entry.targetSets != null && entry.targetSets > 0) {
      return completedWorking >= entry.targetSets;
    }
    return entry.sets.some((set) => Boolean(set.completedAt));
  }).length;
  return { doneExercises, totalExercises: entries.length };
}
