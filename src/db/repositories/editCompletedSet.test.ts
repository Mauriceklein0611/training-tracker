import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { resetDatabase } from '@/tests/dbTestUtils';
import { createExercise } from '@/db/repositories/exercises';
import {
  addExerciseToSession,
  addSet,
  completeSet,
  editCompletedSet,
  startFreeSession,
} from '@/db/repositories/sessions';
import { effectiveLoadKg } from '@/services/metrics';
import type { Exercise } from '@/types';

async function press(): Promise<Exercise> {
  return createExercise({
    name: 'Schulterdrücken',
    primaryMuscleGroup: 'Schultern',
    secondaryMuscleGroups: [],
    equipment: 'Langhantel',
    defaultEquipment: 'barbell',
    trackingType: 'weight_reps',
    weightMode: 'total',
    weightMultiplier: 1,
    defaultRestSeconds: 120,
    notes: '',
  });
}

async function completedSet() {
  const exercise = await press();
  const session = await startFreeSession('Test');
  const se = await addExerciseToSession(session.id, exercise);
  const draft = await addSet(se.id, { restTargetSeconds: 120 });
  await completeSet(draft.id, { weightKg: 38, reps: 10 });
  return { se, set: (await db.workoutSets.get(draft.id))! };
}

beforeEach(async () => {
  await resetDatabase();
});

describe('editCompletedSet (Feature 2)', () => {
  it('corrects a value in place, preserving id, order, rest and completion', async () => {
    const { se, set } = await completedSet();

    await editCompletedSet(set.id, {
      setType: 'working',
      weightKg: 30, // corrected from 38
      reps: 10,
      equipment: 'barbell',
      weightMode: 'total',
      weightMultiplier: 1,
      trackingType: 'weight_reps',
    });

    const after = (await db.workoutSets.get(set.id))!;
    expect(after.id).toBe(set.id);
    expect(after.position).toBe(set.position);
    expect(after.sessionExerciseId).toBe(set.sessionExerciseId);
    expect(after.createdAt).toBe(set.createdAt);
    expect(after.completedAt).toBe(set.completedAt);
    expect(after.restTargetSeconds).toBe(set.restTargetSeconds);
    expect(after.weightKg).toBe(30);
    // The corrected value flows straight into the derived load.
    expect(effectiveLoadKg(after, se)).toBe(30);
    // updatedAt is allowed to move.
    expect(after.updatedAt >= set.updatedAt).toBe(true);
  });

  it('does not start or reset the rest timer', async () => {
    const { set } = await completedSet();
    expect(set.restStartedAt).toBeTruthy(); // completing started the rest

    await editCompletedSet(set.id, {
      setType: 'working',
      weightKg: 30,
      reps: 10,
      equipment: 'barbell',
      weightMode: 'total',
      weightMultiplier: 1,
      trackingType: 'weight_reps',
    });

    const after = (await db.workoutSets.get(set.id))!;
    expect(after.restStartedAt).toBe(set.restStartedAt);
    expect(after.restEndedAt).toBe(set.restEndedAt);
    expect(after.restActualSeconds).toBe(set.restActualSeconds);
  });

  it('creates no duplicate set', async () => {
    const { se, set } = await completedSet();
    const before = await db.workoutSets.where('sessionExerciseId').equals(se.id).count();
    await editCompletedSet(set.id, {
      setType: 'working',
      weightKg: 30,
      reps: 12,
      equipment: 'barbell',
      weightMode: 'total',
      weightMultiplier: 1,
      trackingType: 'weight_reps',
    });
    expect(await db.workoutSets.where('sessionExerciseId').equals(se.id).count()).toBe(
      before,
    );
  });

  it('can re-interpret the set as dumbbells (freezes the new execution)', async () => {
    const { se, set } = await completedSet();
    await editCompletedSet(set.id, {
      setType: 'working',
      weightKg: 19, // was meant to be 19 kg per dumbbell
      reps: 10,
      equipment: 'dumbbells',
      weightMode: 'per_hand',
      weightMultiplier: 2,
      trackingType: 'weight_reps',
    });
    const after = (await db.workoutSets.get(set.id))!;
    expect(after.equipmentSnapshot).toBe('dumbbells');
    expect(after.weightModeSnapshot).toBe('per_hand');
    expect(effectiveLoadKg(after, se)).toBe(38); // 19 × 2
  });
});
