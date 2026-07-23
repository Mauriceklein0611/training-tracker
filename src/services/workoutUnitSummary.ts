import type { Exercise, WorkoutUnitTemplateExercise } from '@/types';

/**
 * Pure summary of a library workout unit for compact list display. Derives only
 * from the unit's exercises — never invents numbers — so the list stays honest
 * for a unit with missing or deleted exercises.
 */
export interface WorkoutUnitSummary {
  exerciseCount: number;
  /** Sum of target working sets across all exercises. */
  totalTargetSets: number;
  /** Primary muscle groups present, most frequent first, deduplicated. */
  muscleGroups: string[];
}

export function summariseWorkoutUnit(
  exercises: (WorkoutUnitTemplateExercise & { exercise?: Exercise })[],
): WorkoutUnitSummary {
  let totalTargetSets = 0;
  const counts = new Map<string, number>();

  for (const row of exercises) {
    totalTargetSets += row.targetSets;
    const group = row.exercise?.primaryMuscleGroup?.trim();
    if (group) counts.set(group, (counts.get(group) ?? 0) + 1);
  }

  const muscleGroups = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'))
    .map(([group]) => group);

  return {
    exerciseCount: exercises.length,
    totalTargetSets,
    muscleGroups,
  };
}
