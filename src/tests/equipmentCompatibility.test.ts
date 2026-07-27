import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { resetDatabase } from '@/tests/dbTestUtils';
import { createExercise, getExercise, updateExercise } from '@/db/repositories/exercises';
import {
  addExerciseToSession,
  addSet,
  completeSet,
  finishSession,
  startFreeSession,
} from '@/db/repositories/sessions';
import { createBackup, importBackup, validateBackupJson } from '@/services/backup';
import { effectiveSetExecution } from '@/services/equipment';
import { setVolumeKg } from '@/services/metrics';
import type { Exercise } from '@/types';

async function makeWeightedExercise(): Promise<Exercise> {
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

beforeEach(async () => {
  await resetDatabase();
});

describe('equipment feature — backward compatibility (schema 27)', () => {
  it('creates an exercise without a default equipment (old-style stays valid)', async () => {
    const exercise = await makeWeightedExercise();
    expect(exercise.defaultEquipment).toBeUndefined();
  });

  it('adding a default equipment later never rewrites past sessions or sets', async () => {
    const exercise = await makeWeightedExercise();
    const session = await startFreeSession('Test');
    const se = await addExerciseToSession(session.id, exercise);
    const set = await addSet(se.id, { restTargetSeconds: 120 });
    await completeSet(set.id, { weightKg: 40, reps: 10 });
    await finishSession(session.id);

    const seBefore = await db.sessionExercises.get(se.id);
    const setBefore = await db.workoutSets.get(set.id);

    // The user edits the exercise afterwards to add a structured default.
    await updateExercise(exercise.id, { defaultEquipment: 'barbell' });
    expect((await getExercise(exercise.id))?.defaultEquipment).toBe('barbell');

    // History is untouched — the snapshot rows are byte-for-byte the same.
    expect(await db.sessionExercises.get(se.id)).toEqual(seBefore);
    expect(await db.workoutSets.get(set.id)).toEqual(setBefore);
  });

  it('computes a historic set via the session-exercise fallback when it has no own snapshot', async () => {
    const exercise = await makeWeightedExercise();
    const session = await startFreeSession('Test');
    const se = await addExerciseToSession(session.id, exercise);
    const set = await addSet(se.id, { restTargetSeconds: 120 });
    await completeSet(set.id, { weightKg: 40, reps: 10 });

    const storedSet = (await db.workoutSets.get(set.id))!;
    const storedSe = (await db.sessionExercises.get(se.id))!;
    // No per-set execution snapshot on this old-style set → fall back to the
    // session-exercise snapshot (total, ×1) rather than the live exercise.
    expect(effectiveSetExecution(storedSet, storedSe).weightMode).toBe('total');
    expect(setVolumeKg(storedSet, storedSe)).toBe(400);
  });

  it('imports an old backup that has no equipment fields at all', async () => {
    const exercise = await makeWeightedExercise();
    const session = await startFreeSession('Test');
    const se = await addExerciseToSession(session.id, exercise);
    const set = await addSet(se.id, { restTargetSeconds: 120 });
    await completeSet(set.id, { weightKg: 40, reps: 10 });
    await finishSession(session.id);

    // Simulate a backup written before schema 27: strip every new field and
    // lower the recorded schema version.
    const raw = JSON.parse(JSON.stringify(await createBackup())) as Record<
      string,
      unknown
    > & {
      schemaVersion: number;
      exercises: Record<string, unknown>[];
      sessionExercises: Record<string, unknown>[];
      workoutSets: Record<string, unknown>[];
    };
    raw.schemaVersion = 26;
    for (const row of raw.exercises) delete row.defaultEquipment;
    for (const row of raw.sessionExercises) delete row.equipmentSnapshot;
    for (const row of raw.workoutSets) {
      delete row.equipmentSnapshot;
      delete row.weightModeSnapshot;
      delete row.weightMultiplierSnapshot;
      delete row.trackingTypeSnapshot;
    }

    const result = validateBackupJson(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await resetDatabase();
    await importBackup(result.backup, 'replace');

    // Every record restored, ids preserved, and the set still computes correctly.
    expect(await db.exercises.get(exercise.id)).toBeTruthy();
    const restoredSet = (await db.workoutSets.get(set.id))!;
    const restoredSe = (await db.sessionExercises.get(se.id))!;
    expect(restoredSet.weightModeSnapshot).toBeUndefined();
    expect(setVolumeKg(restoredSet, restoredSe)).toBe(400);
  });
});
