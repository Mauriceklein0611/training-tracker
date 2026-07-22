import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { createExercise, updateExercise } from '@/db/repositories/exercises';
import {
  addExerciseToSession,
  addSet,
  getSessionDetail,
  startFreeSession,
  swapSessionExercise,
} from '@/db/repositories/sessions';
import { createBackup, importBackup } from '@/services/backup';
import { resetDatabase } from '@/tests/dbTestUtils';
import type { Exercise } from '@/types';

async function makeExerciseRow(name: string): Promise<Exercise> {
  return createExercise({
    name,
    primaryMuscleGroup: 'Test',
    secondaryMuscleGroups: [],
    equipment: '',
    trackingType: 'weight_reps',
    weightMode: 'total',
    weightMultiplier: 1,
    defaultRestSeconds: 90,
    notes: '',
  });
}

beforeEach(async () => {
  await resetDatabase();
});

describe('swapSessionExercise', () => {
  it('replaces the exercise in place and clears its sets', async () => {
    const session = await startFreeSession('Test');
    const bench = await makeExerciseRow('Bankdrücken');
    const dips = await makeExerciseRow('Dips');
    const se = await addExerciseToSession(session.id, bench);
    await addSet(se.id, { restTargetSeconds: 120 });

    await swapSessionExercise(se.id, dips);

    const detail = await getSessionDetail(session.id);
    const entry = detail?.exercises[0];
    expect(entry?.sessionExercise.exerciseId).toBe(dips.id);
    expect(entry?.sessionExercise.exerciseNameSnapshot).toBe('Dips');
    expect(entry?.sessionExercise.restSecondsSnapshot).toBe(90);
    // The previous exercise's sets are gone.
    expect(entry?.sets).toHaveLength(0);
  });
});

describe('technique cues and alternatives', () => {
  it('survive a backup round trip', async () => {
    const bench = await makeExerciseRow('Bankdrücken');
    const dips = await makeExerciseRow('Dips');
    await updateExercise(bench.id, {
      techniqueCues: ['Schulterblätter fixieren', 'Ellbogen leicht anlegen'],
      alternativeExerciseIds: [dips.id],
    });

    const backup = await createBackup();
    await resetDatabase();
    await importBackup(backup, 'replace');

    const restored = await db.exercises.get(bench.id);
    expect(restored?.techniqueCues).toEqual([
      'Schulterblätter fixieren',
      'Ellbogen leicht anlegen',
    ]);
    expect(restored?.alternativeExerciseIds).toEqual([dips.id]);
  });
});
