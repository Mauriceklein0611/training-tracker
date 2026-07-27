import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/db';
import { resetDatabase } from '@/tests/dbTestUtils';
import { createExercise } from '@/db/repositories/exercises';
import { addExerciseToTemplate, createTemplate } from '@/db/repositories/templates';
import {
  getTemplateWithExercises,
  listTemplatesWithExercises,
} from '@/db/repositories/templates';
import { getPlanWithDays } from '@/db/repositories/plans';
import type { TemplateWithExercises } from '@/db/repositories/templates';
import type { WorkoutTemplate } from '@/types';
import { parsePlanPackage } from '@/services/planPackage/parse';
import {
  buildPlanPackage,
  planPackageFingerprint,
  type PlanExportInput,
} from '@/services/planPackage/build';
import {
  analyzePlanPackageImport,
  importPlanPackage,
  listImportedFingerprints,
} from '@/services/planPackage/import';
import { planPackageSchema } from '@/services/planPackage/schema';
import { validPlanPackage, validPlanPackageV1 } from '@/services/planPackage/fixtures';

/** Wraps a single day (template) as a one-plan export input. */
async function exportInputFor(template: WorkoutTemplate): Promise<PlanExportInput> {
  const plan = await getPlanWithDays(template.planId);
  const entry = (await getTemplateWithExercises(template.id)) as TemplateWithExercises;
  return { plan: plan!.plan, days: [entry] };
}

beforeEach(async () => {
  await resetDatabase();
});

function parsedFixture() {
  return planPackageSchema.parse(validPlanPackage());
}

describe('parsePlanPackage', () => {
  it('accepts a valid current package', () => {
    const result = parsePlanPackage(JSON.stringify(validPlanPackage()));
    expect(result.ok).toBe(true);
  });

  it('rejects invalid JSON', () => {
    const result = parsePlanPackage('{not json');
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown weightMode for the tracking type', () => {
    const raw = validPlanPackage();
    raw.exercises[2].weightMode = 'per_hand'; // not allowed for bodyweight_reps
    const result = parsePlanPackage(JSON.stringify(raw));
    expect(result.ok).toBe(false);
  });

  it('rejects a plan position referencing an unknown exercise', () => {
    const raw = validPlanPackage();
    raw.plans[0].days[0].exercises[0].exerciseKey = 'exercise-404';
    const result = parsePlanPackage(JSON.stringify(raw));
    expect(result.ok).toBe(false);
  });

  it('rejects unknown top-level fields (strict)', () => {
    const raw = validPlanPackage() as Record<string, unknown>;
    raw.somethingExtra = true;
    const result = parsePlanPackage(JSON.stringify(raw));
    expect(result.ok).toBe(false);
  });

  it('rejects a newer, unsupported schema version with a clear message', () => {
    const raw = validPlanPackage() as Record<string, unknown>;
    raw.schemaVersion = 999;
    const result = parsePlanPackage(JSON.stringify(raw));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toMatch(/neuere/i);
    }
  });

  it('rejects a file that is too large', () => {
    const result = parsePlanPackage(' '.repeat(600 * 1024));
    expect(result.ok).toBe(false);
  });

  it('upgrades a valid version-1 file and reports the migration', () => {
    const result = parsePlanPackage(JSON.stringify(validPlanPackageV1()));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.migratedFromVersion).toBe(1);
      expect(result.data.schemaVersion).toBe(2);
      expect(result.data.plans[0].days).toHaveLength(1);
    }
  });

  it.each([
    [
      'plan without any day',
      (raw: ReturnType<typeof validPlanPackage>) => (raw.plans[0].days = []),
    ],
    [
      'day without a name',
      (raw: ReturnType<typeof validPlanPackage>) => (raw.plans[0].days[0].name = ''),
    ],
    [
      'invalid split type',
      (raw: ReturnType<typeof validPlanPackage>) =>
        ((raw.plans[0] as { splitType: string }).splitType = '7-day'),
    ],
    [
      'duplicate day position',
      (raw: ReturnType<typeof validPlanPackage>) =>
        (raw.plans[0].days[1].position = raw.plans[0].days[0].position),
    ],
    [
      'rep range reversed',
      (raw: ReturnType<typeof validPlanPackage>) => {
        raw.plans[0].days[0].exercises[0].targetRepMin = 12;
        raw.plans[0].days[0].exercises[0].targetRepMax = 5;
      },
    ],
  ])('rejects an invalid v2 package: %s', (_label, mutate) => {
    const raw = validPlanPackage();
    mutate(raw);
    expect(parsePlanPackage(JSON.stringify(raw)).ok).toBe(false);
  });
});

describe('buildPlanPackage roundtrip', () => {
  async function seedPlan() {
    const bench = await createExercise({
      name: 'Bankdrücken',
      primaryMuscleGroup: 'Brust',
      secondaryMuscleGroups: ['Trizeps'],
      equipment: 'Langhantel',
      trackingType: 'weight_reps',
      weightMode: 'total',
      weightMultiplier: 1,
      defaultRestSeconds: 180,
      notes: '',
    });
    const row = await createExercise({
      name: 'Rudern',
      primaryMuscleGroup: 'Latissimus',
      secondaryMuscleGroups: ['Bizeps'],
      equipment: 'Langhantel',
      trackingType: 'weight_reps',
      weightMode: 'total',
      weightMultiplier: 1,
      defaultRestSeconds: 150,
      notes: '',
    });
    const template = await createTemplate('Oberkörper');
    await addExerciseToTemplate(template.id, bench);
    await addExerciseToTemplate(template.id, row);
    return template;
  }

  it('exports a live plan into a schema-valid package', async () => {
    const template = await seedPlan();
    const pkg = buildPlanPackage([await exportInputFor(template)], {
      packageName: 'Mein Plan',
      source: 'app-export',
    });
    // Already schema-parsed inside buildPlanPackage; re-parse to be sure.
    expect(() => planPackageSchema.parse(pkg)).not.toThrow();
    expect(pkg.plans).toHaveLength(1);
    expect(pkg.plans[0].days).toHaveLength(1);
    expect(pkg.exercises).toHaveLength(2);
    // No internal ids leak into the package.
    expect(JSON.stringify(pkg)).not.toContain(template.id);
    expect(JSON.stringify(pkg)).not.toContain(template.planId);
  });

  it('drops exercise/plan notes when includeNotes is false', async () => {
    const template = await seedPlan();
    const pkg = buildPlanPackage([await exportInputFor(template)], {
      packageName: 'Mein Plan',
      source: 'app-export',
      includeNotes: false,
      programNotes: 'privat',
    });
    expect(pkg.programNotes).toBe('');
    expect(pkg.exercises.every((exercise) => exercise.notes === '')).toBe(true);
  });

  it('round-trips export → import back to an equivalent plan', async () => {
    const template = await seedPlan();
    const pkg = buildPlanPackage([await exportInputFor(template)], {
      packageName: 'Mein Plan',
      source: 'app-export',
    });

    // Fresh database: the exported package should recreate the plan.
    await resetDatabase();
    const analysis = analyzePlanPackageImport(pkg, [], []);
    const result = await importPlanPackage(pkg, analysis);
    expect(result.createdPlans).toBe(1);
    expect(result.createdDays).toBe(1);
    expect(result.createdExercises).toBe(2);

    const [imported] = await listTemplatesWithExercises();
    expect(imported.template.name).toBe('Oberkörper');
    expect(imported.exercises).toHaveLength(2);
  });
});

describe('analyzePlanPackageImport', () => {
  it('marks all exercises as new against an empty database', () => {
    const pkg = parsedFixture();
    const analysis = analyzePlanPackageImport(pkg, [], []);
    expect(analysis.exercises.every((exercise) => exercise.status === 'new')).toBe(true);
    expect(analysis.plans[0].nameConflict).toBe(false);
  });

  it('reuses an existing compatible exercise', async () => {
    const existing = await createExercise({
      name: 'Bankdrücken',
      primaryMuscleGroup: 'Brust',
      secondaryMuscleGroups: ['Trizeps', 'Vordere Schulter'],
      equipment: 'Langhantel',
      trackingType: 'weight_reps',
      weightMode: 'total',
      weightMultiplier: 1,
      defaultRestSeconds: 180,
      notes: '',
    });
    const pkg = parsedFixture();
    const analysis = analyzePlanPackageImport(pkg, [existing], []);
    const bench = analysis.exercises.find((e) => e.name === 'Bankdrücken');
    expect(bench?.status).toBe('reuse');
    expect(bench?.existingExerciseId).toBe(existing.id);
  });

  it('flags an incompatible same-name exercise as a conflict', async () => {
    const existing = await createExercise({
      name: 'Bankdrücken',
      primaryMuscleGroup: 'Brust',
      secondaryMuscleGroups: [],
      equipment: 'Langhantel',
      trackingType: 'duration', // incompatible tracking type
      weightMode: 'none',
      weightMultiplier: 1,
      defaultRestSeconds: 180,
      notes: '',
    });
    const pkg = parsedFixture();
    const analysis = analyzePlanPackageImport(pkg, [existing], []);
    const bench = analysis.exercises.find((e) => e.name === 'Bankdrücken');
    expect(bench?.status).toBe('conflict');
    expect(bench?.resolution).toBe('new-copy');
  });

  it('detects metadata differences on an otherwise compatible exercise', async () => {
    const existing = await createExercise({
      name: 'Bankdrücken',
      primaryMuscleGroup: 'Brust',
      secondaryMuscleGroups: [], // differs from the package
      equipment: 'Kurzhantel', // differs
      trackingType: 'weight_reps',
      weightMode: 'total',
      weightMultiplier: 1,
      defaultRestSeconds: 180,
      notes: '',
    });
    const pkg = parsedFixture();
    const analysis = analyzePlanPackageImport(pkg, [existing], []);
    const bench = analysis.exercises.find((e) => e.name === 'Bankdrücken');
    expect(bench?.status).toBe('metadata-diff');
    expect(bench?.resolution).toBe('reuse');
    expect(bench?.differences.length).toBeGreaterThan(0);
  });

  it('suggests a unique name for a conflicting plan name', () => {
    const pkg = parsedFixture();
    const analysis = analyzePlanPackageImport(pkg, [], ['Oberkörper']);
    expect(analysis.plans[0].nameConflict).toBe(true);
    expect(analysis.plans[0].name).not.toBe('Oberkörper');
  });

  it('surfaces unknown muscle groups without dropping them', () => {
    const raw = validPlanPackage();
    raw.exercises[0].primaryMuscleGroup = 'Fantasiemuskel';
    const pkg = planPackageSchema.parse(raw);
    const analysis = analyzePlanPackageImport(pkg, [], []);
    expect(analysis.unknownMuscleGroups).toContain('Fantasiemuskel');
  });
});

describe('importPlanPackage', () => {
  it('creates a plan with its days and preserves the superset grouping', async () => {
    const pkg = parsedFixture();
    const analysis = analyzePlanPackageImport(pkg, [], []);
    const result = await importPlanPackage(pkg, analysis);
    expect(result.createdExercises).toBe(3);
    expect(result.createdPlans).toBe(1);
    expect(result.createdDays).toBe(2);
    expect(result.createdPlanExercises).toBe(3);

    const plan = (await getPlanWithDays((await db.trainingPlans.toArray())[0].id))!;
    expect(plan.plan.splitType).toBe('2-day');
    expect(plan.days.map((day) => day.name)).toEqual(['Push', 'Pull']);

    // The Push day's two superset members share one group id.
    const push = (await listTemplatesWithExercises()).find(
      (entry) => entry.template.name === 'Push',
    );
    const grouped = push!.exercises.filter((row) => row.groupId);
    expect(grouped).toHaveLength(2);
    expect(new Set(grouped.map((row) => row.groupId)).size).toBe(1);
  });

  it('imports a version-1 package as a plan with a single day', async () => {
    const parsed = parsePlanPackage(JSON.stringify(validPlanPackageV1()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.migratedFromVersion).toBe(1);

    const analysis = analyzePlanPackageImport(parsed.data, [], []);
    const result = await importPlanPackage(parsed.data, analysis);
    expect(result.createdPlans).toBe(1);
    expect(result.createdDays).toBe(1);

    const plan = (await getPlanWithDays((await db.trainingPlans.toArray())[0].id))!;
    expect(plan.plan.splitType).toBe('single');
    expect(plan.days).toHaveLength(1);
    expect(plan.days[0].name).toBe('Tag A');
  });

  it('re-points alternative references onto the imported exercises', async () => {
    const pkg = parsedFixture();
    const analysis = analyzePlanPackageImport(pkg, [], []);
    await importPlanPackage(pkg, analysis);
    const exercises = await db.exercises.toArray();
    const bench = exercises.find((e) => e.name === 'Bankdrücken');
    const alt = exercises.find((e) => e.name === 'Kurzhantel-Bankdrücken');
    expect(bench?.alternativeExerciseIds).toEqual([alt?.id]);
  });

  it('reuses an existing exercise instead of duplicating it', async () => {
    const existing = await createExercise({
      name: 'Bankdrücken',
      primaryMuscleGroup: 'Brust',
      secondaryMuscleGroups: ['Trizeps', 'Vordere Schulter'],
      equipment: 'Langhantel',
      trackingType: 'weight_reps',
      weightMode: 'total',
      weightMultiplier: 1,
      defaultRestSeconds: 180,
      notes: '',
    });
    const pkg = parsedFixture();
    const analysis = analyzePlanPackageImport(pkg, [existing], []);
    const result = await importPlanPackage(pkg, analysis);
    expect(result.reusedExercises).toBe(1);
    expect(result.createdExercises).toBe(2);
    const benches = (await db.exercises.toArray()).filter(
      (e) => e.name === 'Bankdrücken',
    );
    expect(benches).toHaveLength(1);
  });

  it('records the import so a duplicate is detected next time', async () => {
    const pkg = parsedFixture();
    const first = analyzePlanPackageImport(pkg, [], []);
    await importPlanPackage(pkg, first);

    const fingerprints = await listImportedFingerprints();
    expect(fingerprints).toContain(planPackageFingerprint(pkg));

    const second = analyzePlanPackageImport(pkg, [], [], fingerprints);
    expect(second.duplicate).toBe(true);
  });

  describe('canonical fingerprint sensitivity', () => {
    const base = () => planPackageSchema.parse(validPlanPackage());

    it('is stable for the same content and ignores volatile metadata', () => {
      const a = planPackageSchema.parse({
        ...validPlanPackage(),
        packageId: 'other-id',
        createdAt: '2030-12-31T23:59:59.000Z',
        source: { kind: 'app-export' },
      });
      expect(planPackageFingerprint(a)).toBe(planPackageFingerprint(base()));
    });

    it('changes when a duration target changes', () => {
      const pkg = base();
      pkg.plans[0].days[0].exercises[0].targetDurationSeconds = 45;
      expect(planPackageFingerprint(pkg)).not.toBe(planPackageFingerprint(base()));
    });

    it('changes when the weight multiplier changes', () => {
      const pkg = base();
      pkg.exercises[1].weightMultiplier = 3;
      expect(planPackageFingerprint(pkg)).not.toBe(planPackageFingerprint(base()));
    });

    it('changes when the schedule mode or a rest day changes', () => {
      const withSchedule = () => {
        const pkg = base();
        pkg.plans[0].schedule = {
          mode: 'repeating-cycle',
          entries: [
            { type: 'workout', dayKey: 'day-1', position: 0 },
            { type: 'rest', position: 1 },
            { type: 'workout', dayKey: 'day-2', position: 2 },
          ],
        };
        return pkg;
      };
      // A plan with a schedule differs from the default free-rotation.
      expect(planPackageFingerprint(withSchedule())).not.toBe(
        planPackageFingerprint(base()),
      );
      // Removing the rest day changes the fingerprint again.
      const withoutRest = withSchedule();
      withoutRest.plans[0].schedule!.entries =
        withoutRest.plans[0].schedule!.entries.filter((entry) => entry.type !== 'rest');
      expect(planPackageFingerprint(withoutRest)).not.toBe(
        planPackageFingerprint(withSchedule()),
      );
    });
  });

  it('rolls back completely when a write fails mid-transaction', async () => {
    const pkg = parsedFixture();
    const analysis = analyzePlanPackageImport(pkg, [], []);

    // Force a failure after the exercises were added but before completion.
    const spy = vi
      .spyOn(db.templateExercises, 'bulkAdd')
      .mockRejectedValueOnce(new Error('boom'));

    await expect(importPlanPackage(pkg, analysis)).rejects.toBeTruthy();
    spy.mockRestore();

    // Nothing was written — the transaction rolled back.
    expect(await db.workoutTemplates.count()).toBe(0);
    expect(await db.exercises.count()).toBe(0);
    expect(await db.planImports.count()).toBe(0);
  });
});
