import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { createExercise } from '@/db/repositories/exercises';
import {
  addExerciseToSession,
  addSet,
  completeSet,
  startFreeSession,
} from '@/db/repositories/sessions';
import { resetDatabase } from '@/tests/dbTestUtils';
import type { Exercise, WorkoutSet } from '@/types';

type SetValues = Partial<
  Pick<WorkoutSet, 'weightKg' | 'reps' | 'durationSeconds' | 'setType'>
>;

async function seed(): Promise<{ sessionExerciseId: string }> {
  const exercise: Exercise = await createExercise({
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
  const session = await startFreeSession();
  const sessionExercise = await addExerciseToSession(session.id, exercise);
  return { sessionExerciseId: sessionExercise.id };
}

/** Mirrors the live view: complete once, and only then queue the next set. */
async function completeAndMaybeAdd(
  sessionExerciseId: string,
  setId: string,
  values: SetValues,
) {
  const { newlyCompleted } = await completeSet(setId, values);
  if (newlyCompleted) {
    await addSet(sessionExerciseId, {
      setType: 'working',
      restTargetSeconds: 120,
      weightKg: values.weightKg,
      reps: values.reps,
    });
  }
}

function completedSets() {
  return db.workoutSets.filter((set) => Boolean(set.completedAt)).toArray();
}

function openSets() {
  return db.workoutSets.filter((set) => !set.completedAt).toArray();
}

beforeEach(async () => {
  await resetDatabase();
});

describe('completeSet idempotency', () => {
  it('completes a set only once and reports it', async () => {
    const { sessionExerciseId } = await seed();
    const set = await addSet(sessionExerciseId, { restTargetSeconds: 120 });

    const first = await completeSet(set.id, { weightKg: 80, reps: 8 });
    const completedAt = (await db.workoutSets.get(set.id))?.completedAt;
    const second = await completeSet(set.id, { weightKg: 100, reps: 3 });

    expect(first.newlyCompleted).toBe(true);
    expect(second.newlyCompleted).toBe(false);
    // The already-completed set is untouched by the second call.
    const stored = await db.workoutSets.get(set.id);
    expect(stored?.completedAt).toBe(completedAt);
    expect(stored?.weightKg).toBe(80);
    expect(stored?.reps).toBe(8);
  });
});

describe('addSet never leaves two open drafts', () => {
  it('reuses the existing open set instead of creating a second', async () => {
    const { sessionExerciseId } = await seed();
    const first = await addSet(sessionExerciseId, { restTargetSeconds: 120 });
    const second = await addSet(sessionExerciseId, { restTargetSeconds: 120 });

    expect(second.id).toBe(first.id);
    expect(await openSets()).toHaveLength(1);
  });
});

describe('rapid / parallel completion', () => {
  it('leaves exactly one completed set and at most one open follow-up (sequential double tap)', async () => {
    const { sessionExerciseId } = await seed();
    const set = await addSet(sessionExerciseId, { restTargetSeconds: 120 });

    await completeAndMaybeAdd(sessionExerciseId, set.id, {
      setType: 'working',
      weightKg: 80,
      reps: 8,
    });
    await completeAndMaybeAdd(sessionExerciseId, set.id, {
      setType: 'working',
      weightKg: 80,
      reps: 8,
    });

    expect(await completedSets()).toHaveLength(1);
    expect((await openSets()).length).toBeLessThanOrEqual(1);
  });

  it('leaves exactly one completed set and at most one open follow-up (parallel taps)', async () => {
    const { sessionExerciseId } = await seed();
    const set = await addSet(sessionExerciseId, { restTargetSeconds: 120 });

    await Promise.all([
      completeAndMaybeAdd(sessionExerciseId, set.id, {
        setType: 'working',
        weightKg: 80,
        reps: 8,
      }),
      completeAndMaybeAdd(sessionExerciseId, set.id, {
        setType: 'working',
        weightKg: 80,
        reps: 8,
      }),
    ]);

    expect(await completedSets()).toHaveLength(1);
    expect((await openSets()).length).toBeLessThanOrEqual(1);
  });
});
