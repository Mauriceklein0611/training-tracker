import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { resetDatabase } from '@/tests/dbTestUtils';
import { SYSTEM_EXERCISES } from '@/constants/exerciseCatalog';
import { seedSystemExercises } from '@/services/exerciseSeed';
import { createExercise, updateExercise } from '@/db/repositories/exercises';
import { MUSCLE_GROUPS } from '@/constants/muscleGroups';

beforeEach(async () => {
  await resetDatabase();
});

describe('exercise catalog data', () => {
  it('has unique catalog keys', () => {
    const keys = SYSTEM_EXERCISES.map((entry) => entry.catalogKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('uses only known muscle-group labels', () => {
    const labels = new Set(MUSCLE_GROUPS.map((group) => group.label));
    for (const entry of SYSTEM_EXERCISES) {
      expect(labels.has(entry.primaryMuscleGroup)).toBe(true);
      for (const secondary of entry.secondaryMuscleGroups) {
        expect(labels, `${entry.catalogKey}: ${secondary}`).toContain(secondary);
      }
    }
  });

  it('covers a broad range of exercises', () => {
    expect(SYSTEM_EXERCISES.length).toBeGreaterThanOrEqual(80);
  });

  it('includes cardio entries carrying a modality and structured device', () => {
    const cardio = SYSTEM_EXERCISES.filter((entry) => entry.trackingType === 'cardio');
    expect(cardio.length).toBeGreaterThanOrEqual(10);
    for (const entry of cardio) {
      expect(entry.cardioModality).toBeTruthy();
      expect(entry.weightMode).toBe('none');
      expect(entry.defaultEquipment).toBeTruthy();
    }
    // The running/treadmill pair share a modality but differ by device.
    const running = cardio.find((e) => e.catalogKey === 'cardio-running');
    const treadmill = cardio.find((e) => e.catalogKey === 'cardio-treadmill');
    expect(running?.cardioModality).toBe('running');
    expect(treadmill?.cardioModality).toBe('running');
    expect(treadmill?.defaultEquipment).toBe('treadmill');
  });
});

describe('seedSystemExercises', () => {
  it('seeds the whole catalog into an empty database', async () => {
    const result = await seedSystemExercises();
    expect(result.added).toBe(SYSTEM_EXERCISES.length);
    expect(await db.exercises.count()).toBe(SYSTEM_EXERCISES.length);
    const all = await db.exercises.toArray();
    expect(all.every((exercise) => exercise.origin === 'system')).toBe(true);
    // Cardio entries persist their modality and structured device.
    const treadmill = all.find((e) => e.catalogKey === 'cardio-treadmill');
    expect(treadmill?.trackingType).toBe('cardio');
    expect(treadmill?.cardioModality).toBe('running');
    expect(treadmill?.defaultEquipment).toBe('treadmill');
  });

  it('is idempotent — a second run adds nothing', async () => {
    await seedSystemExercises();
    const result = await seedSystemExercises();
    expect(result.added).toBe(0);
    expect(await db.exercises.count()).toBe(SYSTEM_EXERCISES.length);
  });

  it('never overwrites a user edit of a system exercise', async () => {
    await seedSystemExercises();
    const bench = (await db.exercises.toArray()).find(
      (exercise) => exercise.catalogKey === 'bench-press',
    )!;
    await updateExercise(bench.id, { name: 'Mein Bankdrücken', defaultRestSeconds: 240 });

    await seedSystemExercises(); // re-run

    const after = await db.exercises.get(bench.id);
    expect(after?.name).toBe('Mein Bankdrücken');
    expect(after?.defaultRestSeconds).toBe(240);
    // And no duplicate for that key was created.
    const benches = (await db.exercises.toArray()).filter(
      (exercise) => exercise.catalogKey === 'bench-press',
    );
    expect(benches).toHaveLength(1);
  });

  it('leaves a same-named custom exercise untouched and coexisting', async () => {
    const custom = await createExercise({
      name: 'Bankdrücken',
      primaryMuscleGroup: 'Brust',
      secondaryMuscleGroups: [],
      equipment: 'Langhantel',
      trackingType: 'weight_reps',
      weightMode: 'total',
      weightMultiplier: 1,
      defaultRestSeconds: 120,
      notes: '',
    });

    await seedSystemExercises();

    const stillCustom = await db.exercises.get(custom.id);
    expect(stillCustom?.origin).toBe('custom');
    expect(stillCustom?.catalogKey).toBeUndefined();
    // Both the custom and the system "Bankdrücken" exist.
    const named = (await db.exercises.toArray()).filter(
      (exercise) => exercise.name === 'Bankdrücken',
    );
    expect(named.length).toBe(2);
  });
});
