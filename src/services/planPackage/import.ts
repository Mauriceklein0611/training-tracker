import { db, type TrainingDatabase } from '@/db/db';
import type { Exercise, TemplateExercise, TrainingPlan, WorkoutTemplate } from '@/types';
import { nowIso, uuid } from '@/utils/id';
import { planGroupNormalization } from '@/services/grouping';
import { isKnownMuscleGroup } from '@/constants/muscleGroups';
import type { PackageExercise, PlanPackage } from '@/services/planPackage/schema';
import { planPackageFingerprint } from '@/services/planPackage/build';

/**
 * How a package exercise relates to what is already stored, and what will be
 * done with it on import. Local data is never overwritten: a `reuse` links to
 * the existing exercise untouched, everything else creates a new exercise.
 */
export type ExerciseMatchStatus = 'reuse' | 'metadata-diff' | 'conflict' | 'new';
export type ExerciseResolution = 'reuse' | 'new-copy';

export interface ExerciseImportItem {
  exerciseKey: string;
  name: string;
  status: ExerciseMatchStatus;
  /** The existing exercise this matched, if any (for reuse / conflict display). */
  existingExerciseId?: string;
  /** Human-readable metadata differences for a `metadata-diff` match. */
  differences: string[];
  /** Chosen action. `new` is fixed; the others may be toggled by the user. */
  resolution: ExerciseResolution;
}

export interface PlanImportItem {
  planKey: string;
  originalName: string;
  /** Resolved, unique plan name (editable before applying). */
  name: string;
  nameConflict: boolean;
  exerciseCount: number;
}

export interface PlanPackageImportAnalysis {
  packageName: string;
  sourceLabel?: string;
  fingerprint: string;
  /** True when a package with the same content was already imported. */
  duplicate: boolean;
  exercises: ExerciseImportItem[];
  plans: PlanImportItem[];
  /** Muscle-group labels not in the local catalog — kept as-is, only surfaced. */
  unknownMuscleGroups: string[];
  warnings: string[];
}

export interface PlanPackageImportResult {
  createdExercises: number;
  reusedExercises: number;
  createdPlans: number;
  createdPlanExercises: number;
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Core compatibility: the fields that must match to safely reuse an exercise. */
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

function collectMetadataDiffs(pkg: PackageExercise, existing: Exercise): string[] {
  const diffs: string[] = [];
  if (pkg.primaryMuscleGroup !== existing.primaryMuscleGroup) {
    diffs.push('primäre Muskelgruppe');
  }
  const a = [...pkg.secondaryMuscleGroups].sort().join('|');
  const b = [...existing.secondaryMuscleGroups].sort().join('|');
  if (a !== b) diffs.push('sekundäre Muskelgruppen');
  if (pkg.equipment !== existing.equipment) diffs.push('Equipment');
  if (pkg.defaultRestSeconds !== existing.defaultRestSeconds) diffs.push('Pausenzeit');
  return diffs;
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

/**
 * Compares a parsed package against the current database and produces a preview
 * with sensible default resolutions. Pure: it reads no global state beyond the
 * snapshots passed in, so it is easy to test and to render.
 */
export function analyzePlanPackageImport(
  pkg: PlanPackage,
  existingExercises: Exercise[],
  existingTemplates: WorkoutTemplate[],
  importedFingerprints: string[] = [],
): PlanPackageImportAnalysis {
  const byName = new Map<string, Exercise>();
  for (const exercise of existingExercises) {
    const key = normalizeName(exercise.name);
    if (!byName.has(key)) byName.set(key, exercise);
  }

  const exercises: ExerciseImportItem[] = pkg.exercises.map((pkgExercise) => {
    const existing = byName.get(normalizeName(pkgExercise.name));
    if (!existing) {
      return {
        exerciseKey: pkgExercise.exerciseKey,
        name: pkgExercise.name,
        status: 'new',
        differences: [],
        resolution: 'new-copy',
      };
    }
    if (!isCompatibleCore(pkgExercise, existing)) {
      return {
        exerciseKey: pkgExercise.exerciseKey,
        name: pkgExercise.name,
        status: 'conflict',
        existingExerciseId: existing.id,
        differences: ['Tracking oder Gewichtskonvention weicht ab'],
        resolution: 'new-copy',
      };
    }
    const differences = collectMetadataDiffs(pkgExercise, existing);
    return {
      exerciseKey: pkgExercise.exerciseKey,
      name: pkgExercise.name,
      status: differences.length > 0 ? 'metadata-diff' : 'reuse',
      existingExerciseId: existing.id,
      differences,
      resolution: 'reuse',
    };
  });

  const takenPlanNames = new Set(existingTemplates.map((t) => normalizeName(t.name)));
  const plans: PlanImportItem[] = pkg.plans.map((plan) => {
    const conflict = takenPlanNames.has(normalizeName(plan.name));
    const name = conflict
      ? uniqueName(`${plan.name} (importiert)`, takenPlanNames)
      : plan.name;
    takenPlanNames.add(normalizeName(name));
    return {
      planKey: plan.planKey,
      originalName: plan.name,
      name,
      nameConflict: conflict,
      exerciseCount: plan.exercises.length,
    };
  });

  const unknownMuscleGroups = collectUnknownMuscleGroups(pkg);

  const warnings: string[] = [];
  const duplicate = importedFingerprints.includes(planPackageFingerprint(pkg));
  if (duplicate) {
    warnings.push(
      'Dieses Paket wurde bereits importiert. Ein erneuter Import legt zusätzliche Kopien an.',
    );
  }
  if (unknownMuscleGroups.length > 0) {
    warnings.push(
      `Unbekannte Muskelgruppen bleiben erhalten: ${unknownMuscleGroups.join(', ')}.`,
    );
  }

  return {
    packageName: pkg.packageName,
    sourceLabel: pkg.source.label,
    fingerprint: planPackageFingerprint(pkg),
    duplicate,
    exercises,
    plans,
    unknownMuscleGroups,
    warnings,
  };
}

function collectUnknownMuscleGroups(pkg: PlanPackage): string[] {
  const unknown = new Set<string>();
  for (const exercise of pkg.exercises) {
    for (const label of [
      exercise.primaryMuscleGroup,
      ...exercise.secondaryMuscleGroups,
    ]) {
      if (label && !isKnownMuscleGroup(label)) unknown.add(label);
    }
  }
  return [...unknown];
}

/** True when two analyses would resolve two plans to the same final name. */
export function planNameCollisions(analysis: PlanPackageImportAnalysis): string[] {
  const seen = new Map<string, number>();
  for (const plan of analysis.plans) {
    const key = normalizeName(plan.name);
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, count]) => count > 1).map(([name]) => name);
}

function exerciseDraftFromPackage(
  pkg: PackageExercise,
  name: string,
): Omit<Exercise, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name,
    primaryMuscleGroup: pkg.primaryMuscleGroup,
    secondaryMuscleGroups: [...pkg.secondaryMuscleGroups],
    equipment: pkg.equipment,
    trackingType: pkg.trackingType,
    weightMode: pkg.weightMode,
    weightMultiplier: pkg.weightMultiplier,
    defaultRestSeconds: pkg.defaultRestSeconds,
    weightIncrementKg: pkg.weightIncrementKg,
    availableWeightsKg: pkg.availableWeightsKg,
    progressionMethod: pkg.progressionMethod,
    targetRir: pkg.targetRir,
    techniqueCues: pkg.techniqueCues,
    notes: pkg.notes,
    archived: false,
  };
}

/**
 * Applies a resolved analysis in one transaction. Either the whole package is
 * imported or nothing is: on any failure the transaction rolls back, leaving
 * the previous data untouched (imports are transactional and never partial).
 *
 * Local data is never overwritten — a `reuse` links the existing exercise; all
 * other exercises are created fresh. Plans are always created, never merged.
 */
export async function importPlanPackage(
  pkg: PlanPackage,
  analysis: PlanPackageImportAnalysis,
  database: TrainingDatabase = db,
): Promise<PlanPackageImportResult> {
  const result: PlanPackageImportResult = {
    createdExercises: 0,
    reusedExercises: 0,
    createdPlans: 0,
    createdPlanExercises: 0,
  };

  const resolutionByKey = new Map(
    analysis.exercises.map((item) => [item.exerciseKey, item]),
  );
  const nameByPlanKey = new Map(analysis.plans.map((item) => [item.planKey, item.name]));

  await database.transaction(
    'rw',
    [
      database.exercises,
      database.trainingPlans,
      database.workoutTemplates,
      database.templateExercises,
      database.planImports,
    ],
    async () => {
      const existing = await database.exercises.toArray();
      const takenExerciseNames = new Set(existing.map((e) => normalizeName(e.name)));

      // 1) Resolve every package exercise to a local id (reuse or create).
      const idByExerciseKey = new Map<string, string>();
      const created: Exercise[] = [];
      const timestamp = nowIso();

      for (const pkgExercise of pkg.exercises) {
        const item = resolutionByKey.get(pkgExercise.exerciseKey);
        if (item?.resolution === 'reuse' && item.existingExerciseId) {
          idByExerciseKey.set(pkgExercise.exerciseKey, item.existingExerciseId);
          result.reusedExercises += 1;
          continue;
        }
        const desired =
          item?.status === 'new' ? pkgExercise.name : `${pkgExercise.name} (importiert)`;
        const name = uniqueName(desired, takenExerciseNames);
        takenExerciseNames.add(normalizeName(name));
        const exercise: Exercise = {
          ...exerciseDraftFromPackage(pkgExercise, name),
          id: uuid(),
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        idByExerciseKey.set(pkgExercise.exerciseKey, exercise.id);
        created.push(exercise);
        result.createdExercises += 1;
      }

      // 2) Re-point alternative references onto the resolved local ids, dropping
      // any that could not be resolved so the data stays consistent.
      for (const exercise of created) {
        const pkgExercise = pkg.exercises.find(
          (e) => idByExerciseKey.get(e.exerciseKey) === exercise.id,
        );
        const altKeys = pkgExercise?.alternativeExerciseKeys ?? [];
        const altIds = altKeys
          .map((key) => idByExerciseKey.get(key))
          .filter((id): id is string => id != null && id !== exercise.id);
        if (altIds.length > 0) exercise.alternativeExerciseIds = altIds;
      }
      if (created.length > 0) await database.exercises.bulkAdd(created);

      // 3) Create each plan and its exercise rows, then normalize grouping.
      // A schema-v1 package plan maps to a plan with a single day ("Tag A").
      for (const plan of pkg.plans) {
        const planName = nameByPlanKey.get(plan.planKey) ?? plan.name;
        const trainingPlan: TrainingPlan = {
          id: uuid(),
          name: planName,
          description: plan.description,
          splitType: 'single',
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        await database.trainingPlans.add(trainingPlan);

        const template: WorkoutTemplate = {
          id: uuid(),
          planId: trainingPlan.id,
          name: planName,
          description: plan.description,
          position: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        await database.workoutTemplates.add(template);
        result.createdPlans += 1;

        const groupIdByKey = new Map<string, string>();
        const rows: TemplateExercise[] = [...plan.exercises]
          .sort((a, b) => a.order - b.order)
          .map((planExercise, index) => {
            let groupId: string | undefined;
            let groupType: TemplateExercise['groupType'];
            let groupRestMode: TemplateExercise['groupRestMode'];
            if (planExercise.group) {
              const key = planExercise.group.groupKey;
              if (!groupIdByKey.has(key)) groupIdByKey.set(key, uuid());
              groupId = groupIdByKey.get(key);
              groupType = planExercise.group.type;
              groupRestMode = planExercise.group.restMode;
            }
            return {
              id: uuid(),
              templateId: template.id,
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

        // Enforce the grouping invariants (contiguous runs, no singletons).
        const normalized = planGroupNormalization(rows, uuid);
        for (const row of rows) {
          const fields = normalized.get(row.id) ?? {};
          row.groupId = fields.groupId;
          row.groupType = fields.groupType;
          row.groupRestMode = fields.groupRestMode;
        }
        await database.templateExercises.bulkAdd(rows);
        result.createdPlanExercises += rows.length;
      }

      // 4) Record the import so a later identical import can be flagged.
      await database.planImports.add({
        id: uuid(),
        fingerprint: analysis.fingerprint,
        packageName: pkg.packageName,
        importedAt: timestamp,
      });
    },
  );

  return result;
}

/** All recorded import fingerprints, for the duplicate check in the analysis. */
export async function listImportedFingerprints(
  database: TrainingDatabase = db,
): Promise<string[]> {
  const rows = await database.planImports.toArray();
  return rows.map((row) => row.fingerprint);
}
