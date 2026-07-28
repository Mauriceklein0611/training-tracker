import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { resetDatabase } from '@/tests/dbTestUtils';
import { createExercise } from '@/db/repositories/exercises';
import {
  addExerciseToSession,
  addSet,
  completeSet,
  setSessionExerciseExecution,
  startFreeSession,
} from '@/db/repositories/sessions';
import { effectiveSetExecution } from '@/services/equipment';
import { effectiveLoadKg } from '@/services/metrics';
import type { Exercise } from '@/types';

async function barbellPress(): Promise<Exercise> {
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

beforeEach(async () => {
  await resetDatabase();
});

describe('temporary execution change (Feature 3)', () => {
  it('starts a session exercise with the exercise default equipment', async () => {
    const exercise = await barbellPress();
    const session = await startFreeSession('Test');
    const se = await addExerciseToSession(session.id, exercise);
    expect(se.equipmentSnapshot).toBe('barbell');
  });

  it('completing a set freezes its execution snapshot', async () => {
    const exercise = await barbellPress();
    const session = await startFreeSession('Test');
    const se = await addExerciseToSession(session.id, exercise);
    const set = await addSet(se.id, { restTargetSeconds: 120 });
    await completeSet(set.id, { weightKg: 40, reps: 10 });

    const stored = (await db.workoutSets.get(set.id))!;
    expect(stored.weightModeSnapshot).toBe('total');
    expect(stored.equipmentSnapshot).toBe('barbell');
    expect(effectiveLoadKg(stored, se)).toBe(40); // 40 kg barbell total
  });

  it('switching to dumbbells applies to new sets but never rewrites completed ones', async () => {
    const exercise = await barbellPress();
    const session = await startFreeSession('Test');
    const se = await addExerciseToSession(session.id, exercise);

    // Set 1: barbell, 40 kg total.
    const s1 = await addSet(se.id, { restTargetSeconds: 120 });
    await completeSet(s1.id, { weightKg: 40, reps: 10 });

    // Switch execution to dumbbells (per hand, ×2).
    await setSessionExerciseExecution(se.id, {
      equipment: 'dumbbells',
      weightMode: 'per_hand',
      weightMultiplier: 2,
    });

    // The session exercise now defaults to dumbbells for the next set.
    const seAfter = (await db.sessionExercises.get(se.id))!;
    expect(seAfter.equipmentSnapshot).toBe('dumbbells');
    expect(seAfter.weightModeSnapshot).toBe('per_hand');
    expect(seAfter.weightMultiplierSnapshot).toBe(2);

    // Set 1 is untouched: still barbell, still 40 kg total load.
    const set1 = (await db.workoutSets.get(s1.id))!;
    expect(effectiveSetExecution(set1, seAfter).equipment).toBe('barbell');
    expect(effectiveLoadKg(set1, seAfter)).toBe(40);

    // Set 2: 20 kg per hand → 40 kg total load, tagged dumbbells.
    const s2 = await addSet(se.id, { restTargetSeconds: 120 });
    await completeSet(s2.id, { weightKg: 20, reps: 10 });
    const set2 = (await db.workoutSets.get(s2.id))!;
    expect(effectiveSetExecution(set2, seAfter).equipment).toBe('dumbbells');
    expect(effectiveLoadKg(set2, seAfter)).toBe(40);
  });

  it('fills only the missing snapshot fields of a partially-frozen set', async () => {
    const exercise = await barbellPress();
    const session = await startFreeSession('Test');
    const se = await addExerciseToSession(session.id, exercise);
    const set = await addSet(se.id, { restTargetSeconds: 120 });
    await completeSet(set.id, { weightKg: 40, reps: 10 });

    // Simulate a partially-frozen set: it already carries its own equipment
    // (a manual dumbbell tag) but is missing the weight-mode snapshot.
    await db.workoutSets.update(set.id, {
      equipmentSnapshot: 'dumbbells',
      weightModeSnapshot: undefined,
      weightMultiplierSnapshot: undefined,
      trackingTypeSnapshot: undefined,
    });

    await setSessionExerciseExecution(se.id, {
      equipment: 'machine',
      weightMode: 'total',
      weightMultiplier: 1,
    });

    const frozen = (await db.workoutSets.get(set.id))!;
    // The existing equipment field is preserved, never overwritten…
    expect(frozen.equipmentSnapshot).toBe('dumbbells');
    // …while the missing fields are filled from the pre-switch context (barbell
    // was total mode), not from the new machine execution.
    expect(frozen.weightModeSnapshot).toBe('total');
    expect(frozen.trackingTypeSnapshot).toBe('weight_reps');
  });

  it('freezes a pre-feature completed set (no snapshot) before changing execution', async () => {
    const exercise = await barbellPress();
    const session = await startFreeSession('Test');
    const se = await addExerciseToSession(session.id, exercise);
    const set = await addSet(se.id, { restTargetSeconds: 120 });
    await completeSet(set.id, { weightKg: 40, reps: 10 });
    // Simulate a set completed before the per-set snapshot existed.
    await db.workoutSets.update(set.id, {
      equipmentSnapshot: undefined,
      weightModeSnapshot: undefined,
      weightMultiplierSnapshot: undefined,
      trackingTypeSnapshot: undefined,
    });

    await setSessionExerciseExecution(se.id, {
      equipment: 'dumbbells',
      weightMode: 'per_hand',
      weightMultiplier: 2,
    });

    // The old set was frozen with the pre-change execution → still 40 kg total.
    const frozen = (await db.workoutSets.get(set.id))!;
    const seAfter = (await db.sessionExercises.get(se.id))!;
    expect(frozen.weightModeSnapshot).toBe('total');
    expect(frozen.equipmentSnapshot).toBe('barbell');
    expect(effectiveLoadKg(frozen, seAfter)).toBe(40);
  });
});
