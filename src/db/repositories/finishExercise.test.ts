import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { resetDatabase } from '@/tests/dbTestUtils';
import { createExercise } from '@/db/repositories/exercises';
import {
  addExerciseToSession,
  addSet,
  completeSet,
  finishSessionExercise,
  reopenSessionExercise,
  startFreeSession,
} from '@/db/repositories/sessions';
import { workoutProgress } from '@/services/sessionProgress';
import type { Exercise } from '@/types';

async function press(): Promise<Exercise> {
  return createExercise({
    name: 'Schulterdrücken',
    primaryMuscleGroup: 'Schultern',
    secondaryMuscleGroups: [],
    equipment: 'Langhantel',
    trackingType: 'weight_reps',
    weightMode: 'total',
    weightMultiplier: 1,
    defaultRestSeconds: 120,
    notes: '',
  });
}

/**
 * An exercise can be ended by hand when the set goal is not going to be
 * reached. It must never fake the missing sets — only the marker is written.
 */
beforeEach(async () => {
  await resetDatabase();
});

describe('finishing a single exercise early', () => {
  it('marks the exercise without touching its sets or its goal', async () => {
    const exercise = await press();
    const session = await startFreeSession('Test');
    const entry = await addExerciseToSession(session.id, exercise);
    await db.sessionExercises.update(entry.id, { targetSetsSnapshot: 4 });

    const first = await addSet(entry.id, { restTargetSeconds: 120 });
    await completeSet(first.id, { weightKg: 40, reps: 10 });
    const open = await addSet(entry.id, { restTargetSeconds: 120 });

    await finishSessionExercise(entry.id);

    const stored = (await db.sessionExercises.get(entry.id))!;
    expect(stored.finishedAt).toBeTypeOf('string');
    expect(stored.targetSetsSnapshot).toBe(4);

    const sets = await db.workoutSets
      .where('sessionExerciseId')
      .equals(entry.id)
      .toArray();
    expect(sets).toHaveLength(2);
    expect(sets.filter((set) => set.completedAt)).toHaveLength(1);
    // The open draft stays a draft — finishing never completes it.
    expect((await db.workoutSets.get(open.id))!.completedAt).toBeUndefined();
  });

  it('closes a rest that is still running for that exercise', async () => {
    const exercise = await press();
    const session = await startFreeSession('Test');
    const entry = await addExerciseToSession(session.id, exercise);
    const set = await addSet(entry.id, { restTargetSeconds: 120 });
    await completeSet(set.id, { weightKg: 40, reps: 10 }, { startRest: true });

    expect((await db.workoutSets.get(set.id))!.restEndedAt).toBeUndefined();
    await finishSessionExercise(entry.id);
    expect((await db.workoutSets.get(set.id))!.restEndedAt).toBeTypeOf('string');
  });

  it('is idempotent and reversible', async () => {
    const exercise = await press();
    const session = await startFreeSession('Test');
    const entry = await addExerciseToSession(session.id, exercise);
    const set = await addSet(entry.id, { restTargetSeconds: 120 });
    await completeSet(set.id, { weightKg: 40, reps: 10 });

    await finishSessionExercise(entry.id);
    const first = (await db.sessionExercises.get(entry.id))!.finishedAt;
    await finishSessionExercise(entry.id);
    expect((await db.sessionExercises.get(entry.id))!.finishedAt).toBe(first);

    await reopenSessionExercise(entry.id);
    expect((await db.sessionExercises.get(entry.id))!.finishedAt).toBeUndefined();
  });

  it('counts the exercise as done in the workout progress', async () => {
    const exercise = await press();
    const session = await startFreeSession('Test');
    const entry = await addExerciseToSession(session.id, exercise);
    await db.sessionExercises.update(entry.id, { targetSetsSnapshot: 4 });
    const set = await addSet(entry.id, { restTargetSeconds: 120 });
    await completeSet(set.id, { weightKg: 40, reps: 10 });

    const read = async () => {
      const stored = (await db.sessionExercises.get(entry.id))!;
      const sets = await db.workoutSets
        .where('sessionExerciseId')
        .equals(entry.id)
        .toArray();
      return workoutProgress([
        {
          targetSets: stored.targetSetsSnapshot,
          finishedAt: stored.finishedAt,
          sets,
        },
      ]);
    };

    expect(await read()).toEqual({ doneExercises: 0, totalExercises: 1 });
    await finishSessionExercise(entry.id);
    expect(await read()).toEqual({ doneExercises: 1, totalExercises: 1 });
  });
});
