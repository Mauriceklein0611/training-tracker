import { describe, expect, it } from 'vitest';
import type { AnalyticsDataset } from '@/services/analytics';
import { buildRegionExerciseUsage } from '@/services/regionUsage';
import {
  makeExercise,
  makeSession,
  makeSessionExercise,
  makeSet,
} from '@/tests/factories';

function dataset(): AnalyticsDataset {
  const bench = makeExercise({
    id: 'ex-bench',
    name: 'Bankdrücken',
    primaryMuscleGroup: 'Brust',
    secondaryMuscleGroups: ['Trizeps'],
  });
  const s1 = makeSession({ id: 's1', startedAt: '2026-07-06T10:00:00.000Z' });
  const s2 = makeSession({ id: 's2', startedAt: '2026-07-08T10:00:00.000Z' });
  return {
    exercises: [bench],
    sessions: [s1, s2],
    sessionExercises: [
      makeSessionExercise({ id: 'se1', sessionId: 's1', exerciseId: 'ex-bench' }),
      makeSessionExercise({ id: 'se2', sessionId: 's2', exerciseId: 'ex-bench' }),
    ],
    sets: [
      makeSet({ id: 'set1', sessionExerciseId: 'se1', weightKg: 60, reps: 8 }),
      makeSet({ id: 'set2', sessionExerciseId: 'se1', weightKg: 60, reps: 8 }),
      makeSet({ id: 'set3', sessionExerciseId: 'se2', weightKg: 62, reps: 8 }),
    ],
  };
}

describe('buildRegionExerciseUsage', () => {
  it('lists exercises per region with set count and session frequency', () => {
    const usage = buildRegionExerciseUsage(dataset(), null);
    // Brust maps to the chest region, Trizeps to triceps — both get the exercise.
    expect(usage.chest?.[0]).toEqual({
      exerciseName: 'Bankdrücken',
      sets: 3,
      sessions: 2,
    });
    expect(usage.triceps?.[0].exerciseName).toBe('Bankdrücken');
  });

  it('ignores exercises whose muscles map to no region', () => {
    const ds = dataset();
    ds.exercises[0].primaryMuscleGroup = 'Etwas Unbekanntes';
    ds.exercises[0].secondaryMuscleGroups = [];
    expect(buildRegionExerciseUsage(ds, null)).toEqual({});
  });
});
