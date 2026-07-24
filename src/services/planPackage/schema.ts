import { z } from 'zod';
import {
  groupRestModeSchema,
  groupTypeSchema,
  trackingTypeSchema,
  weightModeSchema,
} from '@/db/schemas';
import { PLAN_PACKAGE_FORMAT } from '@/constants/formats';
import { isWeightModeAllowed } from '@/services/exerciseRules';

/**
 * The `training-plan-package` — the one canonical, portable format for
 * AI-created plans, plan export and sharing. It carries one or more plans plus
 * the exercise definitions they reference, using portable keys only (never
 * internal database ids). Strict Zod: unknown fields are rejected, not dropped.
 *
 * Version 2 makes a plan a list of training days (splits). Version 1 (a single
 * implicit day) is still accepted and converted to a one-day plan on import.
 *
 * See docs/FORMAT_COMPATIBILITY.md.
 */

const portableKey = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[\w:\-.]+$/, { message: 'Ungültiger Schlüssel' });

const progressionMethodSchema = z.enum(['auto', 'weight', 'reps']);

const splitTypeSchema = z.enum(['single', '2-day', '3-day', '4-day', '5-day', 'custom']);

export const packageGroupSchema = z
  .object({
    groupKey: portableKey,
    type: groupTypeSchema,
    restMode: groupRestModeSchema,
  })
  .strict();

export const packageExerciseSchema = z
  .object({
    exerciseKey: portableKey,
    name: z.string().min(1).max(200),
    primaryMuscleGroup: z.string().max(100).default(''),
    secondaryMuscleGroups: z.array(z.string().max(100)).max(20).default([]),
    equipment: z.string().max(100).default(''),
    trackingType: trackingTypeSchema,
    weightMode: weightModeSchema,
    weightMultiplier: z.number().positive().max(10).default(1),
    defaultRestSeconds: z.number().int().min(0).max(3600).default(120),
    weightIncrementKg: z.number().positive().max(100).optional(),
    availableWeightsKg: z.array(z.number().positive().max(1000)).max(80).optional(),
    progressionMethod: progressionMethodSchema.optional(),
    targetRir: z.number().min(0).max(10).optional(),
    techniqueCues: z.array(z.string().max(160)).max(12).optional(),
    alternativeExerciseKeys: z.array(portableKey).max(20).optional(),
    notes: z.string().max(2000).default(''),
  })
  .strict();

export const packagePlanExerciseSchema = z
  .object({
    planExerciseKey: portableKey,
    exerciseKey: portableKey,
    order: z.number().int().min(0).max(500),
    targetSets: z.number().int().min(1).max(50).default(3),
    targetRepMin: z.number().int().min(0).max(1000).nullable().optional(),
    targetRepMax: z.number().int().min(0).max(1000).nullable().optional(),
    targetDurationSeconds: z.number().int().min(0).max(36000).nullable().optional(),
    restSeconds: z.number().int().min(0).max(3600).default(120),
    notes: z.string().max(2000).default(''),
    group: packageGroupSchema.nullable().optional(),
  })
  .strict();

/** A single training day (split day) within a plan. May be empty. */
export const packageDaySchema = z
  .object({
    dayKey: portableKey,
    name: z.string().min(1).max(200),
    description: z.string().max(2000).default(''),
    position: z.number().int().min(0).max(500),
    exercises: z.array(packagePlanExerciseSchema).max(100).default([]),
  })
  .strict();

/** One day of a portable schedule (added in package version 3). */
export const packageScheduleEntrySchema = z
  .object({
    type: z.enum(['workout', 'rest']),
    /** References a day of the same plan by its `dayKey` (workout entries). */
    dayKey: portableKey.optional(),
    /** 0 (Monday) – 6 (Sunday), for weekly schedules. */
    weekday: z.number().int().min(0).max(6).optional(),
    label: z.string().max(120).optional(),
    position: z.number().int().min(0).max(500),
  })
  .strict();

/** A plan's portable schedule (added in package version 3). */
export const packageScheduleSchema = z
  .object({
    mode: z.enum(['free-rotation', 'repeating-cycle', 'weekly']),
    entries: z.array(packageScheduleEntrySchema).max(60).default([]),
  })
  .strict();

export const packagePlanSchema = z
  .object({
    planKey: portableKey,
    name: z.string().min(1).max(200),
    description: z.string().max(2000).default(''),
    splitType: splitTypeSchema.default('single'),
    days: z.array(packageDaySchema).min(1).max(20),
    // Added in package version 3; absent means a default free-rotation.
    schedule: packageScheduleSchema.optional(),
  })
  .strict();

/** Shared cross-field validation over the exercise pool and the plans/days. */
function refinePackage(
  data: {
    exercises: z.infer<typeof packageExerciseSchema>[];
    plans: z.infer<typeof packagePlanSchema>[];
  },
  ctx: z.RefinementCtx,
): void {
  // Unique exercise keys + weight-mode validity for the tracking type.
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

  // Alternatives must reference defined exercises.
  for (const [index, exercise] of data.exercises.entries()) {
    for (const [altIndex, altKey] of (exercise.alternativeExerciseKeys ?? []).entries()) {
      if (!exerciseKeys.has(altKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Alternativübung verweist auf unbekannten exerciseKey: ${altKey}`,
          path: ['exercises', index, 'alternativeExerciseKeys', altIndex],
        });
      }
    }
  }

  const planKeys = new Set<string>();
  const dayKeys = new Set<string>();
  // Plan-exercise keys are unique across the whole package.
  const planExerciseKeys = new Set<string>();

  for (const [planIndex, plan] of data.plans.entries()) {
    if (planKeys.has(plan.planKey)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Doppelter planKey: ${plan.planKey}`,
        path: ['plans', planIndex, 'planKey'],
      });
    }
    planKeys.add(plan.planKey);

    const dayPositions = new Set<number>();
    for (const [dayIndex, day] of plan.days.entries()) {
      const dayAt = ['plans', planIndex, 'days', dayIndex] as const;

      if (dayKeys.has(day.dayKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Doppelter dayKey: ${day.dayKey}`,
          path: [...dayAt, 'dayKey'],
        });
      }
      dayKeys.add(day.dayKey);

      if (dayPositions.has(day.position)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Doppelte Tag-Position (position ${day.position}) im Plan`,
          path: [...dayAt, 'position'],
        });
      }
      dayPositions.add(day.position);

      const orders = new Set<number>();
      const groupSettings = new Map<string, string>();

      for (const [exIndex, planExercise] of day.exercises.entries()) {
        const at = [...dayAt, 'exercises', exIndex] as const;

        if (planExerciseKeys.has(planExercise.planExerciseKey)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Doppelter planExerciseKey: ${planExercise.planExerciseKey}`,
            path: [...at, 'planExerciseKey'],
          });
        }
        planExerciseKeys.add(planExercise.planExerciseKey);

        if (!exerciseKeys.has(planExercise.exerciseKey)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Planposition verweist auf unbekannten exerciseKey: ${planExercise.exerciseKey}`,
            path: [...at, 'exerciseKey'],
          });
        }

        if (orders.has(planExercise.order)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Doppelte Reihenfolge (order ${planExercise.order}) am Tag`,
            path: [...at, 'order'],
          });
        }
        orders.add(planExercise.order);

        const { targetRepMin, targetRepMax } = planExercise;
        if (targetRepMin != null && targetRepMax != null && targetRepMin > targetRepMax) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'targetRepMin darf nicht größer als targetRepMax sein',
            path: [...at, 'targetRepMin'],
          });
        }

        if (planExercise.group) {
          const signature = `${planExercise.group.type}:${planExercise.group.restMode}`;
          const existing = groupSettings.get(planExercise.group.groupKey);
          if (existing != null && existing !== signature) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Gruppe „${planExercise.group.groupKey}" hat widersprüchliche Einstellungen`,
              path: [...at, 'group'],
            });
          }
          groupSettings.set(planExercise.group.groupKey, signature);
        }
      }
    }

    // Schedule (package v3): entries must reference days of THIS plan; weekly
    // entries need a weekday, workout entries a dayKey.
    if (plan.schedule) {
      const planDayKeys = new Set(plan.days.map((day) => day.dayKey));
      const usedWeekdays = new Set<number>();
      for (const [entryIndex, entry] of plan.schedule.entries.entries()) {
        const entryAt = ['plans', planIndex, 'schedule', 'entries', entryIndex] as const;
        if (
          entry.type === 'workout' &&
          (!entry.dayKey || !planDayKeys.has(entry.dayKey))
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Zeitplan verweist auf unbekannten dayKey: ${entry.dayKey ?? '—'}`,
            path: [...entryAt, 'dayKey'],
          });
        }
        if (plan.schedule.mode === 'weekly') {
          if (entry.weekday == null) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Wochenplan-Eintrag braucht einen weekday (0–6)',
              path: [...entryAt, 'weekday'],
            });
          } else if (usedWeekdays.has(entry.weekday)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Wochentag ${entry.weekday} ist doppelt belegt`,
              path: [...entryAt, 'weekday'],
            });
          } else {
            usedWeekdays.add(entry.weekday);
          }
        }
      }
    }
  }
}

export const planPackageSchema = z
  .object({
    format: z.literal(PLAN_PACKAGE_FORMAT),
    // Both 2 (no schedule) and 3 (schedule) share this schema; schedule is
    // optional, so a version-2 file still validates and imports as free-rotation.
    schemaVersion: z.union([z.literal(2), z.literal(3)]),
    packageId: portableKey,
    createdAt: z.string(),
    source: z
      .object({
        kind: z.enum(['ai-generated', 'app-export']),
        label: z.string().max(120).optional(),
      })
      .strict(),
    packageName: z.string().min(1).max(200),
    programNotes: z.string().max(4000).default(''),
    exercises: z.array(packageExerciseSchema).max(300).default([]),
    plans: z.array(packagePlanSchema).min(1).max(50),
  })
  .strict()
  .superRefine(refinePackage);

// ---- version 1 (single implicit day) — accepted for import only ----------

const packagePlanSchemaV1 = z
  .object({
    planKey: portableKey,
    name: z.string().min(1).max(200),
    description: z.string().max(2000).default(''),
    exercises: z.array(packagePlanExerciseSchema).min(1).max(100),
  })
  .strict();

export const planPackageSchemaV1 = z
  .object({
    format: z.literal(PLAN_PACKAGE_FORMAT),
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
    programNotes: z.string().max(4000).default(''),
    exercises: z.array(packageExerciseSchema).min(1).max(300),
    plans: z.array(packagePlanSchemaV1).min(1).max(50),
  })
  .strict();

export type PlanPackage = z.infer<typeof planPackageSchema>;
export type PlanPackageV1 = z.infer<typeof planPackageSchemaV1>;
export type PackageExercise = z.infer<typeof packageExerciseSchema>;
export type PackagePlan = z.infer<typeof packagePlanSchema>;
export type PackageDay = z.infer<typeof packageDaySchema>;
export type PackagePlanExercise = z.infer<typeof packagePlanExerciseSchema>;
export type PackageGroup = z.infer<typeof packageGroupSchema>;

/** Converts a validated v1 package into the current (v2) day-based shape. */
export function upgradeV1(pkg: PlanPackageV1): PlanPackage {
  return {
    format: pkg.format,
    schemaVersion: 2,
    packageId: pkg.packageId,
    createdAt: pkg.createdAt,
    source: pkg.source,
    packageName: pkg.packageName,
    programNotes: pkg.programNotes,
    exercises: pkg.exercises,
    plans: pkg.plans.map((plan) => ({
      planKey: plan.planKey,
      name: plan.name,
      description: plan.description,
      splitType: 'single' as const,
      days: [
        {
          dayKey: `${plan.planKey}-day-1`,
          name: 'Tag A',
          description: '',
          position: 0,
          exercises: plan.exercises,
        },
      ],
    })),
  };
}
