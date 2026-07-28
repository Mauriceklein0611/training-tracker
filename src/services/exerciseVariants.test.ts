import { describe, expect, it } from 'vitest';
import type { AnalyticsDataset } from '@/services/analytics';
import { distinctExerciseVariants } from '@/services/exerciseVariants';
import {
  makeExercise,
  makeSession,
  makeSessionExercise,
  makeSet,
} from '@/tests/factories';

function dataset(): AnalyticsDataset {
  const press = makeExercise({ id: 'ex-press', name: 'Schulterdrücken' });
  const session = makeSession({ id: 's1' });
  return {
    exercises: [press],
    sessions: [session],
    sessionExercises: [
      // Barbell (total) session-exercise.
      makeSessionExercise({
        id: 'se-bar',
        sessionId: 's1',
        exerciseId: 'ex-press',
        equipmentSnapshot: 'barbell',
        weightModeSnapshot: 'total',
      }),
      // Dumbbell (per hand) session-exercise.
      makeSessionExercise({
        id: 'se-db',
        sessionId: 's1',
        exerciseId: 'ex-press',
        order: 1,
        equipmentSnapshot: 'dumbbells',
        weightModeSnapshot: 'per_hand',
      }),
    ],
    sets: [
      makeSet({ id: 'set-bar', sessionExerciseId: 'se-bar', weightKg: 60, reps: 8 }),
      makeSet({ id: 'set-db', sessionExerciseId: 'se-db', weightKg: 22.5, reps: 10 }),
    ],
  };
}

describe('distinctExerciseVariants', () => {
  it('lists the distinct executions the exercise was performed with', () => {
    const variants = distinctExerciseVariants(dataset(), 'ex-press');
    expect(variants).toContain('Langhantel');
    expect(variants.some((v) => v.includes('Kurzhanteln') && v.includes('Je Hand'))).toBe(
      true,
    );
  });

  it('is empty for an exercise with no completed sets', () => {
    expect(distinctExerciseVariants(dataset(), 'ex-missing')).toEqual([]);
  });
});
