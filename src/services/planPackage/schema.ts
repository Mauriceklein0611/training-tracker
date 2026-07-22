import { z } from 'zod';
import {
  groupRestModeSchema,
  groupTypeSchema,
  trackingTypeSchema,
  weightModeSchema,
} from '@/db/schemas';
import { PLAN_PACKAGE_FORMAT, PLAN_PACKAGE_SCHEMA_VERSION } from '@/constants/formats';
import { isWeightModeAllowed } from '@/services/exerciseRules';

/**
 * The `training-plan-package` — the one canonical, portable format for
 * AI-created plans, plan export and sharing. It carries one or more plans plus
 * the exercise definitions they reference, using portable keys only (never
 * internal database ids). Strict Zod: unknown fields are rejected, not dropped.
 *
 * See docs/FORMAT_COMPATIBILITY.md.
 */

const portableKey = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[\w:\-.]+$/, { message: 'Ungültiger Schlüssel' });

const progressionMethodSchema = z.enum(['auto', 'weight', 'reps']);

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

export const packagePlanSchema = z
  .object({
    planKey: portableKey,
    name: z.string().min(1).max(200),
    description: z.string().max(2000).default(''),
    exercises: z.array(packagePlanExerciseSchema).min(1).max(100),
  })
  .strict();

export const planPackageSchema = z
  .object({
    format: z.literal(PLAN_PACKAGE_FORMAT),
    schemaVersion: z.literal(PLAN_PACKAGE_SCHEMA_VERSION),
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
    plans: z.array(packagePlanSchema).min(1).max(50),
  })
  .strict()
  .superRefine((data, ctx) => {
    // Unique exercise keys.
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

      // Weight convention must be valid for the tracking type.
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
      for (const [altIndex, altKey] of (
        exercise.alternativeExerciseKeys ?? []
      ).entries()) {
        if (!exerciseKeys.has(altKey)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Alternativübung verweist auf unbekannten exerciseKey: ${altKey}`,
            path: ['exercises', index, 'alternativeExerciseKeys', altIndex],
          });
        }
      }
    }

    // Unique plan keys.
    const planKeys = new Set<string>();
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

      const orders = new Set<number>();
      const groupSettings = new Map<string, string>();

      for (const [exIndex, planExercise] of plan.exercises.entries()) {
        const at = ['plans', planIndex, 'exercises', exIndex] as const;

        if (planExerciseKeys.has(planExercise.planExerciseKey)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Doppelter planExerciseKey: ${planExercise.planExerciseKey}`,
            path: [...at, 'planExerciseKey'],
          });
        }
        planExerciseKeys.add(planExercise.planExerciseKey);

        // Reference an exercise that exists.
        if (!exerciseKeys.has(planExercise.exerciseKey)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Planposition verweist auf unbekannten exerciseKey: ${planExercise.exerciseKey}`,
            path: [...at, 'exerciseKey'],
          });
        }

        // Unique order within the plan.
        if (orders.has(planExercise.order)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Doppelte Reihenfolge (order ${planExercise.order}) im Plan`,
            path: [...at, 'order'],
          });
        }
        orders.add(planExercise.order);

        // Rep range must stay logical.
        const { targetRepMin, targetRepMax } = planExercise;
        if (targetRepMin != null && targetRepMax != null && targetRepMin > targetRepMax) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'targetRepMin darf nicht größer als targetRepMax sein',
            path: [...at, 'targetRepMin'],
          });
        }

        // A group key must describe one consistent group (same type + rest mode).
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
  });

export type PlanPackage = z.infer<typeof planPackageSchema>;
export type PackageExercise = z.infer<typeof packageExerciseSchema>;
export type PackagePlan = z.infer<typeof packagePlanSchema>;
export type PackagePlanExercise = z.infer<typeof packagePlanExerciseSchema>;
export type PackageGroup = z.infer<typeof packageGroupSchema>;
