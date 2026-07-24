import type { TemplateWithExercises } from '@/db/repositories/templates';
import type { Exercise, PlanSchedule, ScheduleEntry, TrainingPlan } from '@/types';
import { PLAN_PACKAGE_FORMAT, PLAN_PACKAGE_SCHEMA_VERSION } from '@/constants/formats';
import { planPackageSchema, type PlanPackage } from '@/services/planPackage/schema';
import { fingerprint, stableStringify } from '@/utils/fingerprint';
import { dayKey } from '@/utils/date';
import { uuid } from '@/utils/id';

/** One plan to export, together with its resolved training days and schedule. */
export interface PlanExportInput {
  plan: TrainingPlan;
  days: TemplateWithExercises[];
  /** The plan's schedule; omitted exports as a default free-rotation. */
  schedule?: { schedule: PlanSchedule; entries: ScheduleEntry[] };
}

type PackageSchedule = NonNullable<PlanPackage['plans'][number]['schedule']>;

/**
 * Portable schedule for a plan. free-rotation carries no entries (order comes
 * from the day positions); repeating-cycle and weekly carry entries that
 * reference days by their portable `dayKey`. A missing schedule → free-rotation.
 */
function buildPackageSchedule(
  input: PlanExportInput,
  dayKeyByTemplateId: Map<string, string>,
): PackageSchedule {
  const mode = input.schedule?.schedule.mode ?? 'free-rotation';
  if (!input.schedule || mode === 'free-rotation') {
    return { mode: 'free-rotation', entries: [] };
  }
  const ordered = [...input.schedule.entries].sort((a, b) => a.position - b.position);
  const entries: PackageSchedule['entries'] = [];
  for (const [index, entry] of ordered.entries()) {
    const portableDayKey = entry.templateId
      ? dayKeyByTemplateId.get(entry.templateId)
      : undefined;
    // A workout entry whose day is not part of this export is dropped rather
    // than exported as a dangling reference.
    if (entry.type === 'workout' && !portableDayKey) continue;
    entries.push({
      type: entry.type,
      position: index,
      ...(portableDayKey ? { dayKey: portableDayKey } : {}),
      ...(entry.weekday != null ? { weekday: entry.weekday } : {}),
      ...(entry.label ? { label: entry.label } : {}),
    });
  }
  return { mode, entries };
}

export interface BuildPlanPackageOptions {
  packageName: string;
  source: 'ai-generated' | 'app-export';
  sourceLabel?: string;
  /** Free-text plan/exercise notes are dropped when false (privacy). */
  includeNotes?: boolean;
  programNotes?: string;
  now?: Date;
  packageId?: string;
}

/**
 * Builds a `training-plan-package` (v2) from one or more plans.
 *
 * Only the plans, their days, the exercise definitions those days reference
 * (plus one level of their alternatives) and the fields needed to rebuild the
 * plan are exported. Portable keys are generated per export — internal database
 * ids never leave the device. No history, sets, PRs, body data, check-ins,
 * settings or ids.
 */
export function buildPlanPackage(
  inputs: PlanExportInput[],
  options: BuildPlanPackageOptions,
): PlanPackage {
  const includeNotes = options.includeNotes ?? true;
  const note = (value: string) => (includeNotes ? value : '');

  const allDays = inputs.flatMap((input) => input.days);

  // Resolve the exercises actually needed: every day position's exercise plus
  // one level of its alternatives (filtered to the included set below).
  const exercisesById = new Map<string, Exercise>();
  for (const day of allDays) {
    for (const row of day.exercises) {
      if (row.exercise) exercisesById.set(row.exercise.id, row.exercise);
    }
  }
  const includedIds = new Set(exercisesById.keys());
  for (const exercise of [...exercisesById.values()]) {
    for (const altId of exercise.alternativeExerciseIds ?? []) {
      includedIds.add(altId);
    }
  }

  const exerciseKeyById = new Map<string, string>();
  let exerciseCounter = 0;
  for (const id of includedIds) {
    exerciseKeyById.set(id, `exercise-${(exerciseCounter += 1)}`);
  }

  const packageExercises = [...includedIds]
    .map((id) => exercisesById.get(id))
    .filter((exercise): exercise is Exercise => exercise != null)
    .map((exercise) => {
      const alternativeExerciseKeys = (exercise.alternativeExerciseIds ?? [])
        .filter((altId) => exerciseKeyById.has(altId) && exercisesById.has(altId))
        .map((altId) => exerciseKeyById.get(altId) as string);
      return {
        exerciseKey: exerciseKeyById.get(exercise.id) as string,
        name: exercise.name,
        primaryMuscleGroup: exercise.primaryMuscleGroup,
        secondaryMuscleGroups: exercise.secondaryMuscleGroups,
        equipment: exercise.equipment,
        trackingType: exercise.trackingType,
        weightMode: exercise.weightMode,
        weightMultiplier: exercise.weightMultiplier,
        defaultRestSeconds: exercise.defaultRestSeconds,
        weightIncrementKg: exercise.weightIncrementKg,
        availableWeightsKg: exercise.availableWeightsKg,
        progressionMethod: exercise.progressionMethod,
        targetRir: exercise.targetRir,
        techniqueCues: exercise.techniqueCues,
        ...(alternativeExerciseKeys.length > 0 ? { alternativeExerciseKeys } : {}),
        notes: note(exercise.notes),
      };
    });

  let planCounter = 0;
  let dayCounter = 0;
  let planExerciseCounter = 0;
  const groupKeyById = new Map<string, string>();
  let groupCounter = 0;

  const plans = inputs.map((input) => {
    const planKey = `plan-${(planCounter += 1)}`;
    const sortedDays = [...input.days].sort(
      (a, b) => a.template.position - b.template.position,
    );

    // Assign each day its portable key up front so the schedule can reference it.
    const dayKeyByTemplateId = new Map<string, string>();
    for (const day of sortedDays) {
      dayKeyByTemplateId.set(day.template.id, `day-${(dayCounter += 1)}`);
    }

    return {
      planKey,
      name: input.plan.name,
      description: note(input.plan.description),
      splitType: input.plan.splitType,
      schedule: buildPackageSchedule(input, dayKeyByTemplateId),
      days: sortedDays.map((day, dayIndex) => {
        const rows = [...day.exercises]
          .filter((row) => row.exercise && exerciseKeyById.has(row.exercise.id))
          .sort((a, b) => a.order - b.order);

        return {
          dayKey: dayKeyByTemplateId.get(day.template.id) as string,
          name: day.template.name,
          description: note(day.template.description),
          position: dayIndex,
          exercises: rows.map((row, index) => {
            let group =
              null as PlanPackage['plans'][number]['days'][number]['exercises'][number]['group'];
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
      }),
    };
  });

  const pkg = {
    format: PLAN_PACKAGE_FORMAT,
    schemaVersion: PLAN_PACKAGE_SCHEMA_VERSION,
    packageId: options.packageId ?? uuid(),
    createdAt: (options.now ?? new Date()).toISOString(),
    source: {
      kind: options.source,
      ...(options.sourceLabel ? { label: options.sourceLabel } : {}),
    },
    packageName: options.packageName,
    programNotes: note(options.programNotes ?? ''),
    exercises: packageExercises,
    plans,
  };

  // Parse through the schema so an export can never produce an invalid package.
  return planPackageSchema.parse(pkg);
}

/**
 * Deterministic fingerprint of a package's *content* (ignoring the volatile
 * packageId, createdAt and source), for duplicate-import detection.
 */
export function planPackageFingerprint(pkg: PlanPackage): string {
  const nameByKey = new Map(pkg.exercises.map((e) => [e.exerciseKey, e.name]));
  const canonical = {
    exercises: pkg.exercises.map((exercise) => ({
      name: exercise.name.trim().toLowerCase(),
      trackingType: exercise.trackingType,
      weightMode: exercise.weightMode,
      primaryMuscleGroup: exercise.primaryMuscleGroup,
      secondaryMuscleGroups: [...exercise.secondaryMuscleGroups].sort(),
    })),
    plans: pkg.plans.map((plan) => ({
      name: plan.name.trim().toLowerCase(),
      splitType: plan.splitType,
      days: plan.days.map((day) => ({
        name: day.name.trim().toLowerCase(),
        position: day.position,
        exercises: day.exercises.map((planExercise) => ({
          exercise: nameByKey.get(planExercise.exerciseKey),
          order: planExercise.order,
          targetSets: planExercise.targetSets,
          targetRepMin: planExercise.targetRepMin ?? null,
          targetRepMax: planExercise.targetRepMax ?? null,
          restSeconds: planExercise.restSeconds,
          group: planExercise.group
            ? { type: planExercise.group.type, restMode: planExercise.group.restMode }
            : null,
        })),
      })),
    })),
  };
  return fingerprint(stableStringify(canonical));
}

/** `training-plan-package-Push-2026-07-21.json` */
export function planPackageFileName(
  packageName: string,
  date: Date = new Date(),
): string {
  const slug = packageName
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\w-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `training-plan-package-${slug || 'plan'}-${dayKey(date)}.json`;
}
