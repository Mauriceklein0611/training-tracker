import { beforeEach, describe, expect, it } from 'vitest';
import { createExercise } from '@/db/repositories/exercises';
import {
  addExerciseToSession,
  addSet,
  completeSet,
  finishSession,
  getExerciseHistorySets,
  startFreeSession,
} from '@/db/repositories/sessions';
import { buildRecordBaseline } from '@/services/comparison';
import { resetDatabase } from '@/tests/dbTestUtils';
import type { Exercise } from '@/types';

async function makeExerciseRow(): Promise<Exercise> {
  return createExercise({
    name: 'Bankdrücken',
    primaryMuscleGroup: 'Brust',
    secondaryMuscleGroups: [],
    equipment: '',
    trackingType: 'weight_reps',
    weightMode: 'total',
    weightMultiplier: 1,
    defaultRestSeconds: 120,
    notes: '',
  });
}

/** Runs one finished session of the exercise with a single working set. */
async function loggedSession(exercise: Exercise, weightKg: number) {
  const session = await startFreeSession();
  const se = await addExerciseToSession(session.id, exercise);
  const set = await addSet(se.id, { restTargetSeconds: 120 });
  await completeSet(set.id, { weightKg, reps: 5 });
  await finishSession(session.id);
  return session;
}

beforeEach(async () => {
  await resetDatabase();
});

describe('getExerciseHistorySets', () => {
  it('spans all completed sessions and excludes the running one', async () => {
    const exercise = await makeExerciseRow();
    await loggedSession(exercise, 100); // older, heavier
    await loggedSession(exercise, 90); // more recent, lighter

    // A running workout that must not be part of its own baseline.
    const current = await startFreeSession();
    const currentSe = await addExerciseToSession(current.id, exercise);
    const currentSet = await addSet(currentSe.id, { restTargetSeconds: 120 });
    await completeSet(currentSet.id, { weightKg: 95, reps: 5 });

    const history = await getExerciseHistorySets(exercise.id, current.id);
    // Two completed sets from the two finished sessions; the running one excluded.
    expect(history).toHaveLength(2);

    const baseline = buildRecordBaseline(history);
    // The older 100 kg record stands, even though the last session was only 90.
    expect(baseline.bestLoadKg).toBe(100);
  });

  it('ignores sets from sessions that are not completed', async () => {
    const exercise = await makeExerciseRow();
    // An unfinished session should contribute nothing.
    const session = await startFreeSession();
    const se = await addExerciseToSession(session.id, exercise);
    const set = await addSet(se.id, { restTargetSeconds: 120 });
    await completeSet(set.id, { weightKg: 110, reps: 5 });

    // Exclude nothing; the still-active session must still be ignored.
    expect(await getExerciseHistorySets(exercise.id)).toHaveLength(0);
  });
});
