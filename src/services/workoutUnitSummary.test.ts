import { describe, expect, it } from 'vitest';
import { summariseWorkoutUnit } from '@/services/workoutUnitSummary';
import type { Exercise, WorkoutUnitTemplateExercise } from '@/types';

const NOW = '2026-07-01T08:00:00.000Z';

function exercise(id: string, primaryMuscleGroup: string): Exercise {
  return {
    id,
    name: id,
    primaryMuscleGroup,
    secondaryMuscleGroups: [],
    equipment: '',
    trackingType: 'weight_reps',
    weightMode: 'total',
    weightMultiplier: 1,
    defaultRestSeconds: 120,
    notes: '',
    archived: false,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function row(
  overrides: Partial<WorkoutUnitTemplateExercise> & { exercise?: Exercise },
): WorkoutUnitTemplateExercise & { exercise?: Exercise } {
  return {
    id: 'r',
    unitTemplateId: 'u',
    exerciseId: overrides.exercise?.id ?? 'e',
    order: 0,
    targetSets: 3,
    restSeconds: 120,
    notes: '',
    ...overrides,
  };
}

describe('summariseWorkoutUnit', () => {
  it('counts exercises and sums target sets', () => {
    const summary = summariseWorkoutUnit([
      row({ targetSets: 3, exercise: exercise('a', 'Brust') }),
      row({ targetSets: 4, exercise: exercise('b', 'Rücken') }),
    ]);
    expect(summary.exerciseCount).toBe(2);
    expect(summary.totalTargetSets).toBe(7);
  });

  it('lists primary muscle groups by frequency, most frequent first', () => {
    const summary = summariseWorkoutUnit([
      row({ exercise: exercise('a', 'Brust') }),
      row({ exercise: exercise('b', 'Brust') }),
      row({ exercise: exercise('c', 'Trizeps') }),
    ]);
    expect(summary.muscleGroups).toEqual(['Brust', 'Trizeps']);
  });

  it('ignores exercises that no longer exist without inventing groups', () => {
    const summary = summariseWorkoutUnit([
      row({ targetSets: 3, exercise: undefined }),
      row({ targetSets: 2, exercise: exercise('b', 'Beine') }),
    ]);
    expect(summary.exerciseCount).toBe(2);
    expect(summary.totalTargetSets).toBe(5);
    expect(summary.muscleGroups).toEqual(['Beine']);
  });
});
