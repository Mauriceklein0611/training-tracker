import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { resetDatabase } from '@/tests/dbTestUtils';
import { createExercise } from '@/db/repositories/exercises';
import {
  addExerciseToSession,
  addSet,
  completeSet,
  editCompletedCardioSet,
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

  it('corrects a completed cardio section in place, preserving metadata', async () => {
    const exercise = await runningExercise();
    const session = await startFreeSession('Cardio');
    const se = await addExerciseToSession(session.id, exercise);
    const set = await addSet(se.id, { restTargetSeconds: 60 });
    await completeSet(set.id, { durationSeconds: 1800, distanceMeters: 6000 });
    const before = (await db.workoutSets.get(set.id))!;

    await editCompletedCardioSet(set.id, {
      durationSeconds: 1500,
      distanceMeters: 5500,
      averageHeartRateBpm: 148,
      cardioModality: 'running',
    });

    const after = (await db.workoutSets.get(set.id))!;
    expect(after.durationSeconds).toBe(1500);
    expect(after.distanceMeters).toBe(5500);
    expect(after.averageHeartRateBpm).toBe(148);
    // Identity and completion metadata are preserved.
    expect(after.id).toBe(before.id);
    expect(after.position).toBe(before.position);
    expect(after.completedAt).toBe(before.completedAt);
    // Stays pure cardio — no strength fields sneak in.
    expect(after.weightKg).toBeUndefined();
    expect(after.trackingTypeSnapshot).toBe('cardio');
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
