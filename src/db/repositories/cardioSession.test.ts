import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { resetDatabase } from '@/tests/dbTestUtils';
import { createExercise } from '@/db/repositories/exercises';
import {
  addExerciseToSession,
  addSet,
  completeSet,
  startFreeSession,
} from '@/db/repositories/sessions';
import { effectiveSetExecution } from '@/services/equipment';
import type { Exercise } from '@/types';

async function runningExercise(): Promise<Exercise> {
  return createExercise({
    name: 'Laufen',
    primaryMuscleGroup: 'Ganzkörper',
    secondaryMuscleGroups: [],
    equipment: '',
    defaultEquipment: 'treadmill',
    trackingType: 'cardio',
    cardioModality: 'running',
    weightMode: 'none',
    weightMultiplier: 1,
    defaultRestSeconds: 60,
    notes: '',
  });
}

beforeEach(async () => {
  await resetDatabase();
});

describe('cardio live tracking', () => {
  it('snapshots the modality onto the session exercise', async () => {
    const exercise = await runningExercise();
    const session = await startFreeSession('Cardio');
    const se = await addExerciseToSession(session.id, exercise);
    expect(se.trackingTypeSnapshot).toBe('cardio');
    expect(se.cardioModalitySnapshot).toBe('running');
    expect(se.equipmentSnapshot).toBe('treadmill');
  });

  it('stores cardio metrics and freezes the modality on completion', async () => {
    const exercise = await runningExercise();
    const session = await startFreeSession('Cardio');
    const se = await addExerciseToSession(session.id, exercise);
    const set = await addSet(se.id, { restTargetSeconds: 60 });
    await completeSet(set.id, {
      durationSeconds: 1800,
      distanceMeters: 6000,
      averageHeartRateBpm: 150,
    });

    const stored = (await db.workoutSets.get(set.id))!;
    expect(stored.durationSeconds).toBe(1800);
    expect(stored.distanceMeters).toBe(6000);
    expect(stored.averageHeartRateBpm).toBe(150);
    // The modality is frozen so a later modality change never rewrites it.
    expect(stored.cardioModalitySnapshot).toBe('running');
    expect(effectiveSetExecution(stored, se).trackingType).toBe('cardio');
    // No weight is invented.
    expect(stored.weightKg).toBeUndefined();
  });

  it('a cardio section can be completed with only a distance', async () => {
    const exercise = await runningExercise();
    const session = await startFreeSession('Cardio');
    const se = await addExerciseToSession(session.id, exercise);
    const set = await addSet(se.id, { restTargetSeconds: 60 });
    const { newlyCompleted } = await completeSet(set.id, { distanceMeters: 5000 });
    expect(newlyCompleted).toBe(true);
    const stored = (await db.workoutSets.get(set.id))!;
    expect(stored.distanceMeters).toBe(5000);
    expect(stored.durationSeconds).toBeUndefined();
  });

  it('completing a cardio section is idempotent under a double tap', async () => {
    const exercise = await runningExercise();
    const session = await startFreeSession('Cardio');
    const se = await addExerciseToSession(session.id, exercise);
    const set = await addSet(se.id, { restTargetSeconds: 60 });
    const first = await completeSet(set.id, { durationSeconds: 600 });
    const second = await completeSet(set.id, { durationSeconds: 999 });
    expect(first.newlyCompleted).toBe(true);
    expect(second.newlyCompleted).toBe(false);
    // The second (racing) completion never overwrote the recorded value.
    expect((await db.workoutSets.get(set.id))?.durationSeconds).toBe(600);
  });
});
