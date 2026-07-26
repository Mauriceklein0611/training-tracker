import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { resetDatabase } from '@/tests/dbTestUtils';
import { createExercise } from '@/db/repositories/exercises';
import {
  addExerciseToWorkoutUnit,
  createWorkoutUnit,
  getWorkoutUnitWithExercises,
  listWorkoutUnits,
  listWorkoutUnitsWithExercises,
} from '@/db/repositories/workoutUnits';
import {
  analyzeUnitPackageImport,
  buildWorkoutUnitPackage,
  importWorkoutUnitPackage,
  parseWorkoutUnitPackage,
  workoutUnitPackageSchema,
} from '@/services/unitPackage';
import type { Exercise } from '@/types';

async function makeExercise(name: string): Promise<Exercise> {
  return createExercise({
    name,
    primaryMuscleGroup: name,
    secondaryMuscleGroups: [],
    equipment: 'Langhantel',
    trackingType: 'weight_reps',
    weightMode: 'total',
    weightMultiplier: 1,
    defaultRestSeconds: 120,
    notes: '',
  });
}

async function seedUnit() {
  const bench = await makeExercise('Bankdrücken');
  const press = await makeExercise('Schulterdrücken');
  const unit = await createWorkoutUnit({ name: 'Push', description: 'Druck' });
  await addExerciseToWorkoutUnit(unit.id, bench);
  await addExerciseToWorkoutUnit(unit.id, press);
  return unit;
}

beforeEach(async () => {
  await resetDatabase();
});

describe('buildWorkoutUnitPackage', () => {
  it('exports a unit into a schema-valid package without leaking ids', async () => {
    const unit = await seedUnit();
    const detail = (await getWorkoutUnitWithExercises(unit.id))!;
    const pkg = buildWorkoutUnitPackage([detail], {
      packageName: 'Push',
      source: 'app-export',
    });
    expect(() => workoutUnitPackageSchema.parse(pkg)).not.toThrow();
    expect(pkg.units).toHaveLength(1);
    expect(pkg.units[0].exercises).toHaveLength(2);
    expect(pkg.exercises).toHaveLength(2);
    expect(JSON.stringify(pkg)).not.toContain(unit.id);
  });

  it('drops notes when includeNotes is false', async () => {
    const unit = await seedUnit();
    const detail = (await getWorkoutUnitWithExercises(unit.id))!;
    const pkg = buildWorkoutUnitPackage([detail], {
      packageName: 'Push',
      source: 'app-export',
      includeNotes: false,
    });
    expect(pkg.exercises.every((e) => e.notes === '')).toBe(true);
  });
});

describe('parseWorkoutUnitPackage', () => {
  it('accepts a package produced by the builder', async () => {
    const unit = await seedUnit();
    const detail = (await getWorkoutUnitWithExercises(unit.id))!;
    const pkg = buildWorkoutUnitPackage([detail], {
      packageName: 'Push',
      source: 'app-export',
    });
    const result = parseWorkoutUnitPackage(JSON.stringify(pkg));
    expect(result.ok).toBe(true);
  });

  it('rejects a newer unsupported version', async () => {
    const unit = await seedUnit();
    const detail = (await getWorkoutUnitWithExercises(unit.id))!;
    const raw = JSON.parse(
      JSON.stringify(
        buildWorkoutUnitPackage([detail], { packageName: 'X', source: 'app-export' }),
      ),
    );
    raw.schemaVersion = 99;
    const result = parseWorkoutUnitPackage(JSON.stringify(raw));
    expect(result.ok).toBe(false);
  });

  it('rejects a unit position referencing an unknown exerciseKey', async () => {
    const unit = await seedUnit();
    const detail = (await getWorkoutUnitWithExercises(unit.id))!;
    const raw = JSON.parse(
      JSON.stringify(
        buildWorkoutUnitPackage([detail], { packageName: 'X', source: 'app-export' }),
      ),
    );
    raw.units[0].exercises[0].exerciseKey = 'ex-unknown';
    const result = parseWorkoutUnitPackage(JSON.stringify(raw));
    expect(result.ok).toBe(false);
  });
});

describe('importWorkoutUnitPackage', () => {
  it('round-trips export → import into a fresh database', async () => {
    const unit = await seedUnit();
    const detail = (await getWorkoutUnitWithExercises(unit.id))!;
    const pkg = buildWorkoutUnitPackage([detail], {
      packageName: 'Push',
      source: 'app-export',
    });

    await resetDatabase();
    const result = await importWorkoutUnitPackage(pkg);
    expect(result.createdUnits).toBe(1);
    expect(result.createdExercises).toBe(2);
    expect(result.createdUnitExercises).toBe(2);

    const [imported] = await listWorkoutUnitsWithExercises();
    expect(imported.unit.name).toBe('Push');
    expect(imported.exercises).toHaveLength(2);
  });

  it('reuses a compatible same-name exercise instead of duplicating', async () => {
    const unit = await seedUnit();
    const detail = (await getWorkoutUnitWithExercises(unit.id))!;
    const pkg = buildWorkoutUnitPackage([detail], {
      packageName: 'Push',
      source: 'app-export',
    });

    // Fresh db but with the two exercises already present (compatible).
    await resetDatabase();
    await makeExercise('Bankdrücken');
    await makeExercise('Schulterdrücken');

    const result = await importWorkoutUnitPackage(pkg);
    expect(result.reusedExercises).toBe(2);
    expect(result.createdExercises).toBe(0);
    expect(await db.exercises.count()).toBe(2); // no duplicates
    expect(await listWorkoutUnits()).toHaveLength(1);
  });

  it('flags a duplicate import via the fingerprint', async () => {
    const unit = await seedUnit();
    const detail = (await getWorkoutUnitWithExercises(unit.id))!;
    const pkg = buildWorkoutUnitPackage([detail], {
      packageName: 'Push',
      source: 'app-export',
    });
    await resetDatabase();
    await importWorkoutUnitPackage(pkg);

    const fps = (await db.planImports.toArray()).map((r) => r.fingerprint);
    const preview = analyzeUnitPackageImport(pkg, await db.exercises.toArray(), fps);
    expect(preview.alreadyImported).toBe(true);
    expect(preview.unitNames).toEqual(['Push']);
  });
});
