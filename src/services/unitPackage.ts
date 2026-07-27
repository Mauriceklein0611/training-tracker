import { z } from 'zod';
import { db, type TrainingDatabase } from '@/db/db';
import {
  packageExerciseSchema,
  packagePlanExerciseSchema,
  type PackageExercise,
} from '@/services/planPackage/schema';
import {
  WORKOUT_UNIT_PACKAGE_FORMAT,
  WORKOUT_UNIT_PACKAGE_SCHEMA_VERSION,
  SUPPORTED_WORKOUT_UNIT_PACKAGE_VERSIONS,
} from '@/constants/formats';
import { isWeightModeAllowed } from '@/services/exerciseRules';
import type { Exercise, WorkoutUnitTemplate, WorkoutUnitTemplateExercise } from '@/types';
import type { WorkoutUnitWithExercises } from '@/db/repositories/workoutUnits';
import { fingerprint, stableStringify } from '@/utils/fingerprint';
import { dayKey } from '@/utils/date';
import { nowIso, uuid } from '@/utils/id';

/**
 * The `training-workout-unit-package` (Phase 7.6): a small, strictly versioned
 * portable format for sharing one or more library workout units — the exercise
 * definitions they use, their target values and groups. No plans, no history, no
 * body data, no internal ids. Mirrors the plan-package's exercise schema so the
 * two stay consistent; strict Zod rejects unknown fields.
 */

const portableKey = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[\w:\-.]+$/, { message: 'Ungültiger Schlüssel' });

export const packageUnitSchema = z
  .object({
    unitKey: portableKey,
    name: z.string().min(1).max(200),
    description: z.string().max(2000).default(''),
    exercises: z.array(packagePlanExerciseSchema).max(100).default([]),
  })
  .strict();

function refineUnitPackage(
  data: {
    exercises: PackageExercise[];
    units: z.infer<typeof packageUnitSchema>[];
  },
  ctx: z.RefinementCtx,
): void {
  const exerciseKeys = new Set<string>();
  for (const [index, exercise] of data.exercises.entries()) {
    if (exerciseKeys.has(exercise.exerciseKey)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Doppelter exerciseKey: ${exercise.exerciseKey}`,
        path: ['exercises', index, 'exerciseKey'],
      });
    }
    exerciseKeys.add(exercise.exerciseKey);
    if (!isWeightModeAllowed(exercise.trackingType, exercise.weightMode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `weightMode „${exercise.weightMode}" ist für trackingType „${exercise.trackingType}" nicht erlaubt`,
        path: ['exercises', index, 'weightMode'],
      });
    }
  }

  const unitKeys = new Set<string>();
  const unitExerciseKeys = new Set<string>();
  for (const [unitIndex, unit] of data.units.entries()) {
    if (unitKeys.has(unit.unitKey)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Doppelter unitKey: ${unit.unitKey}`,
        path: ['units', unitIndex, 'unitKey'],
      });
    }
    unitKeys.add(unit.unitKey);

    const orders = new Set<number>();
    for (const [exIndex, planExercise] of unit.exercises.entries()) {
      const at = ['units', unitIndex, 'exercises', exIndex] as const;
      if (unitExerciseKeys.has(planExercise.planExerciseKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Doppelter planExerciseKey: ${planExercise.planExerciseKey}`,
          path: [...at, 'planExerciseKey'],
        });
      }
      unitExerciseKeys.add(planExercise.planExerciseKey);
      if (!exerciseKeys.has(planExercise.exerciseKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Position verweist auf unbekannten exerciseKey: ${planExercise.exerciseKey}`,
          path: [...at, 'exerciseKey'],
        });
      }
      if (orders.has(planExercise.order)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Doppelte Reihenfolge (order ${planExercise.order})`,
          path: [...at, 'order'],
        });
      }
      orders.add(planExercise.order);
    }
  }
}

export const workoutUnitPackageSchema = z
  .object({
    format: z.literal(WORKOUT_UNIT_PACKAGE_FORMAT),
    schemaVersion: z.literal(1),
    packageId: portableKey,
    createdAt: z.string(),
    source: z
      .object({
        kind: z.enum(['ai-generated', 'app-export']),
        label: z.string().max(120).optional(),
      })
      .strict(),
    packageName: z.string().min(1).max(200),
    exercises: z.array(packageExerciseSchema).max(300).default([]),
    units: z.array(packageUnitSchema).min(1).max(50),
  })
  .strict()
  .superRefine(refineUnitPackage);

export type WorkoutUnitPackage = z.infer<typeof workoutUnitPackageSchema>;

// ---- build ------------------------------------------------------------

export interface BuildWorkoutUnitPackageOptions {
  packageName: string;
  source: 'ai-generated' | 'app-export';
  includeNotes?: boolean;
  now?: Date;
  packageId?: string;
}

export function buildWorkoutUnitPackage(
  units: WorkoutUnitWithExercises[],
  options: BuildWorkoutUnitPackageOptions,
): WorkoutUnitPackage {
  const includeNotes = options.includeNotes ?? true;
  const note = (value: string) => (includeNotes ? value : '');

  // Exercise pool: every exercise referenced by any unit (plus alternatives).
  const exercisesById = new Map<string, Exercise>();
  for (const unit of units) {
    for (const row of unit.exercises) {
      if (row.exercise) exercisesById.set(row.exercise.id, row.exercise);
    }
  }
  const includedIds = new Set(exercisesById.keys());
  for (const exercise of [...exercisesById.values()]) {
    for (const altId of exercise.alternativeExerciseIds ?? []) {
      if (exercisesById.has(altId)) includedIds.add(altId);
    }
  }

  const exerciseKeyById = new Map<string, string>();
  let exerciseCounter = 0;
  for (const id of includedIds) {
    exerciseKeyById.set(id, `ex-${(exerciseCounter += 1)}`);
  }

  const packageExercises = [...includedIds].map((id) => {
    const exercise = exercisesById.get(id) as Exercise;
    const altKeys = (exercise.alternativeExerciseIds ?? [])
      .filter((altId) => exerciseKeyById.has(altId))
      .map((altId) => exerciseKeyById.get(altId) as string);
    return {
      exerciseKey: exerciseKeyById.get(id) as string,
      name: exercise.name,
      primaryMuscleGroup: exercise.primaryMuscleGroup,
      secondaryMuscleGroups: exercise.secondaryMuscleGroups,
      equipment: exercise.equipment,
      trackingType: exercise.trackingType,
      weightMode: exercise.weightMode,
      weightMultiplier: exercise.weightMultiplier,
      defaultRestSeconds: exercise.defaultRestSeconds,
      ...(exercise.weightIncrementKg != null
        ? { weightIncrementKg: exercise.weightIncrementKg }
        : {}),
      ...(exercise.availableWeightsKg
        ? { availableWeightsKg: exercise.availableWeightsKg }
        : {}),
      ...(exercise.progressionMethod
        ? { progressionMethod: exercise.progressionMethod }
        : {}),
      ...(exercise.targetRir != null ? { targetRir: exercise.targetRir } : {}),
      ...(exercise.techniqueCues ? { techniqueCues: exercise.techniqueCues } : {}),
      ...(altKeys.length > 0 ? { alternativeExerciseKeys: altKeys } : {}),
      notes: note(exercise.notes),
    };
  });

  let unitCounter = 0;
  let planExerciseCounter = 0;
  const groupKeyById = new Map<string, string>();
  let groupCounter = 0;

  const packageUnits = units.map((unit) => {
    const rows = [...unit.exercises]
      .filter((row) => row.exercise && exerciseKeyById.has(row.exercise.id))
      .sort((a, b) => a.order - b.order);
    return {
      unitKey: `unit-${(unitCounter += 1)}`,
      name: unit.unit.name,
      description: note(unit.unit.description),
      exercises: rows.map((row, index) => {
        type PackageGroup = NonNullable<
          z.infer<typeof packagePlanExerciseSchema>['group']
        >;
        let group: PackageGroup | null = null;
        if (row.groupId) {
          if (!groupKeyById.has(row.groupId)) {
            groupKeyById.set(row.groupId, `group-${(groupCounter += 1)}`);
          }
          group = {
            groupKey: groupKeyById.get(row.groupId) as string,
            type: row.groupType ?? 'superset',
            restMode: row.groupRestMode ?? 'round',
          };
        }
        return {
          planExerciseKey: `pe-${(planExerciseCounter += 1)}`,
          exerciseKey: exerciseKeyById.get((row.exercise as Exercise).id) as string,
          order: index,
          targetSets: row.targetSets,
          targetRepMin: row.targetRepMin ?? null,
          targetRepMax: row.targetRepMax ?? null,
          targetDurationSeconds: row.targetDurationSeconds ?? null,
          restSeconds: row.restSeconds,
          notes: note(row.notes),
          group,
        };
      }),
    };
  });

  return workoutUnitPackageSchema.parse({
    format: WORKOUT_UNIT_PACKAGE_FORMAT,
    schemaVersion: WORKOUT_UNIT_PACKAGE_SCHEMA_VERSION,
    packageId: options.packageId ?? uuid(),
    createdAt: (options.now ?? new Date()).toISOString(),
    source: { kind: options.source },
    packageName: options.packageName,
    exercises: packageExercises,
    units: packageUnits,
  });
}

/**
 * Content fingerprint (ignores only the volatile packageId/createdAt/source).
 *
 * Canonical over every portable business field of the units and their
 * exercises, so a change to any target (sets, rep range, duration), the rest,
 * a note, the group, the unit description or the exercise definition changes the
 * fingerprint. Ordering-independent: exercises sorted by name, unit exercises by
 * their stable order.
 */
export function workoutUnitPackageFingerprint(pkg: WorkoutUnitPackage): string {
  const exerciseByKey = new Map(pkg.exercises.map((e) => [e.exerciseKey, e]));
  const content = {
    exercises: [...pkg.exercises]
      .map((e) => ({
        name: e.name.trim().toLowerCase(),
        trackingType: e.trackingType,
        weightMode: e.weightMode,
        weightMultiplier: e.weightMultiplier,
        equipment: e.equipment.trim().toLowerCase(),
        defaultRestSeconds: e.defaultRestSeconds,
        primaryMuscleGroup: e.primaryMuscleGroup,
        secondaryMuscleGroups: [...e.secondaryMuscleGroups].sort(),
      }))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
    units: pkg.units.map((unit) => ({
      name: unit.name.trim().toLowerCase(),
      description: unit.description.trim(),
      exercises: [...unit.exercises]
        .sort((a, b) => a.order - b.order)
        .map((pe) => ({
          exercise:
            exerciseByKey.get(pe.exerciseKey)?.name.trim().toLowerCase() ??
            pe.exerciseKey,
          order: pe.order,
          targetSets: pe.targetSets,
          targetRepMin: pe.targetRepMin ?? null,
          targetRepMax: pe.targetRepMax ?? null,
          targetDurationSeconds: pe.targetDurationSeconds ?? null,
          restSeconds: pe.restSeconds,
          notes: pe.notes.trim(),
          group: pe.group ? { type: pe.group.type, restMode: pe.group.restMode } : null,
        })),
    })),
  };
  return fingerprint(stableStringify(content));
}

export function workoutUnitPackageFileName(date: Date = new Date()): string {
  return `training-uebungseinheiten-${dayKey(date)}.json`;
}

// ---- parse ------------------------------------------------------------

export const MAX_UNIT_PACKAGE_BYTES = 512 * 1024;

export type ParseUnitPackageResult =
  { ok: true; data: WorkoutUnitPackage } | { ok: false; errors: string[] };

export function parseWorkoutUnitPackage(text: string): ParseUnitPackageResult {
  if (text.length > MAX_UNIT_PACKAGE_BYTES) {
    return { ok: false, errors: ['Die Datei ist zu groß.'] };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['Die Datei ist kein gültiges JSON.'] };
  }
  const isPackage =
    typeof raw === 'object' &&
    raw != null &&
    (raw as { format?: unknown }).format === WORKOUT_UNIT_PACKAGE_FORMAT;
  const version = isPackage
    ? (raw as { schemaVersion?: unknown }).schemaVersion
    : undefined;
  if (
    typeof version === 'number' &&
    !SUPPORTED_WORKOUT_UNIT_PACKAGE_VERSIONS.includes(
      version as (typeof SUPPORTED_WORKOUT_UNIT_PACKAGE_VERSIONS)[number],
    )
  ) {
    return {
      ok: false,
      errors: [
        `Diese Datei verwendet eine neuere, nicht unterstützte Paketversion (${version}). ` +
          'Bitte aktualisiere zuerst die App.',
      ],
    };
  }
  const parsed = workoutUnitPackageSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map(
        (issue) => `${issue.path.join('.') || '(Wurzel)'}: ${issue.message}`,
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

// ---- import -----------------------------------------------------------

export interface UnitPackageImportResult {
  createdExercises: number;
  reusedExercises: number;
  createdUnits: number;
  createdUnitExercises: number;
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function isCompatibleCore(pkg: PackageExercise, existing: Exercise): boolean {
  if (pkg.trackingType !== existing.trackingType) return false;
  if (pkg.weightMode !== existing.weightMode) return false;
  if (
    pkg.weightMode === 'per_hand' &&
    pkg.weightMultiplier !== existing.weightMultiplier
  ) {
    return false;
  }
  return true;
}

function uniqueName(desired: string, taken: Set<string>): string {
  const base = desired.trim() || 'Import';
  if (!taken.has(normalizeName(base))) return base;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${base} (${i})`;
    if (!taken.has(normalizeName(candidate))) return candidate;
  }
  return `${base} (${uuid().slice(0, 6)})`;
}

export interface UnitPackageImportPreview {
  fingerprint: string;
  alreadyImported: boolean;
  unitNames: string[];
  newExercises: number;
  reusedExercises: number;
}

export function analyzeUnitPackageImport(
  pkg: WorkoutUnitPackage,
  existingExercises: Exercise[],
  importedFingerprints: string[],
): UnitPackageImportPreview {
  const byName = new Map(existingExercises.map((e) => [normalizeName(e.name), e]));
  let reused = 0;
  let created = 0;
  for (const pkgExercise of pkg.exercises) {
    const existing = byName.get(normalizeName(pkgExercise.name));
    if (existing && isCompatibleCore(pkgExercise, existing)) reused += 1;
    else created += 1;
  }
  const fp = workoutUnitPackageFingerprint(pkg);
  return {
    fingerprint: fp,
    alreadyImported: importedFingerprints.includes(fp),
    unitNames: pkg.units.map((u) => u.name),
    newExercises: created,
    reusedExercises: reused,
  };
}

/**
 * Imports the units in one Dexie transaction. Compatible same-name exercises are
 * reused; incompatible ones are created as a de-duplicated copy. Existing units,
 * plans, sessions and history are never touched. Rolls back fully on any error.
 */
export async function importWorkoutUnitPackage(
  pkg: WorkoutUnitPackage,
  database: TrainingDatabase = db,
): Promise<UnitPackageImportResult> {
  const result: UnitPackageImportResult = {
    createdExercises: 0,
    reusedExercises: 0,
    createdUnits: 0,
    createdUnitExercises: 0,
  };
  const fp = workoutUnitPackageFingerprint(pkg);

  await database.transaction(
    'rw',
    [
      database.exercises,
      database.workoutUnitTemplates,
      database.workoutUnitTemplateExercises,
      database.planImports,
    ],
    async () => {
      const existing = await database.exercises.toArray();
      const byName = new Map(existing.map((e) => [normalizeName(e.name), e]));
      const takenNames = new Set(existing.map((e) => normalizeName(e.name)));
      const timestamp = nowIso();

      // 1) Resolve every package exercise to a local id.
      const idByExerciseKey = new Map<string, string>();
      const createdExercises: Exercise[] = [];
      for (const pkgExercise of pkg.exercises) {
        const match = byName.get(normalizeName(pkgExercise.name));
        if (match && isCompatibleCore(pkgExercise, match)) {
          idByExerciseKey.set(pkgExercise.exerciseKey, match.id);
          result.reusedExercises += 1;
          continue;
        }
        const name = uniqueName(
          match ? `${pkgExercise.name} (importiert)` : pkgExercise.name,
          takenNames,
        );
        takenNames.add(normalizeName(name));
        const exercise: Exercise = {
          id: uuid(),
          name,
          origin: 'custom',
          primaryMuscleGroup: pkgExercise.primaryMuscleGroup,
          secondaryMuscleGroups: [...pkgExercise.secondaryMuscleGroups],
          equipment: pkgExercise.equipment,
          trackingType: pkgExercise.trackingType,
          weightMode: pkgExercise.weightMode,
          weightMultiplier: pkgExercise.weightMultiplier,
          defaultRestSeconds: pkgExercise.defaultRestSeconds,
          weightIncrementKg: pkgExercise.weightIncrementKg,
          availableWeightsKg: pkgExercise.availableWeightsKg,
          progressionMethod: pkgExercise.progressionMethod,
          targetRir: pkgExercise.targetRir,
          techniqueCues: pkgExercise.techniqueCues,
          notes: pkgExercise.notes,
          archived: false,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        idByExerciseKey.set(pkgExercise.exerciseKey, exercise.id);
        createdExercises.push(exercise);
        result.createdExercises += 1;
      }
      if (createdExercises.length > 0) await database.exercises.bulkAdd(createdExercises);

      // 2) Create the units and their exercises.
      for (const unit of pkg.units) {
        const unitRow: WorkoutUnitTemplate = {
          id: uuid(),
          name: unit.name,
          description: unit.description,
          archived: false,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        await database.workoutUnitTemplates.add(unitRow);
        result.createdUnits += 1;

        const groupIdByKey = new Map<string, string>();
        const rows: WorkoutUnitTemplateExercise[] = [...unit.exercises]
          .sort((a, b) => a.order - b.order)
          .map((planExercise, index) => {
            let groupId: string | undefined;
            let groupType: WorkoutUnitTemplateExercise['groupType'];
            let groupRestMode: WorkoutUnitTemplateExercise['groupRestMode'];
            if (planExercise.group) {
              const key = planExercise.group.groupKey;
              if (!groupIdByKey.has(key)) groupIdByKey.set(key, uuid());
              groupId = groupIdByKey.get(key);
              groupType = planExercise.group.type;
              groupRestMode = planExercise.group.restMode;
            }
            return {
              id: uuid(),
              unitTemplateId: unitRow.id,
              exerciseId: idByExerciseKey.get(planExercise.exerciseKey) as string,
              order: index,
              targetSets: planExercise.targetSets,
              targetRepMin: planExercise.targetRepMin ?? undefined,
              targetRepMax: planExercise.targetRepMax ?? undefined,
              targetDurationSeconds: planExercise.targetDurationSeconds ?? undefined,
              restSeconds: planExercise.restSeconds,
              notes: planExercise.notes,
              groupId,
              groupType,
              groupRestMode,
            };
          });
        if (rows.length > 0) await database.workoutUnitTemplateExercises.bulkAdd(rows);
        result.createdUnitExercises += rows.length;
      }

      await database.planImports.add({
        id: uuid(),
        fingerprint: fp,
        packageName: pkg.packageName,
        importedAt: timestamp,
      });
    },
  );

  return result;
}
