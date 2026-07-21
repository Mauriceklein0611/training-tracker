import { z } from 'zod';

/**
 * Zod schemas for every persisted entity.
 *
 * These are the single source of truth when validating an imported backup
 * file. Unknown properties are stripped so a file from a newer app version can
 * still be read, while missing or wrongly typed fields are rejected.
 */

const isoDateTime = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Kein gültiger Zeitstempel' });

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Datum muss im Format JJJJ-MM-TT vorliegen' });

const id = z.string().min(1, 'ID fehlt');

export const trackingTypeSchema = z.enum([
  'weight_reps',
  'bodyweight_reps',
  'assisted_bodyweight_reps',
  'reps_only',
  'duration',
]);

export const weightModeSchema = z.enum([
  'per_hand',
  'total',
  'added_weight',
  'assistance',
  'none',
]);

export const setTypeSchema = z.enum(['warmup', 'working', 'drop', 'failure']);

export const groupTypeSchema = z.enum(['superset', 'circuit']);
export const groupRestModeSchema = z.enum(['each', 'round']);

/**
 * Optional superset / circuit grouping. Added in schema version 8; every field
 * is optional, so templates and sessions from older backups still validate and
 * import as plain standalone exercises.
 */
const groupingFields = {
  groupId: id.optional(),
  groupType: groupTypeSchema.optional(),
  groupRestMode: groupRestModeSchema.optional(),
};

export const exerciseSchema = z.object({
  id,
  name: z.string().min(1, 'Name darf nicht leer sein'),
  primaryMuscleGroup: z.string().default(''),
  secondaryMuscleGroups: z.array(z.string()).default([]),
  equipment: z.string().default(''),
  trackingType: trackingTypeSchema,
  weightMode: weightModeSchema,
  weightMultiplier: z.number().positive().max(10).default(1),
  defaultRestSeconds: z.number().int().min(0).max(3600).default(120),
  // Added in schema version 6; all optional, so older backups still validate.
  weightIncrementKg: z.number().positive().max(100).optional(),
  availableWeightsKg: z.array(z.number().positive().max(1000)).max(80).optional(),
  progressionMethod: z.enum(['auto', 'weight', 'reps']).optional(),
  targetRir: z.number().min(0).max(10).optional(),
  notes: z.string().default(''),
  archived: z.boolean().default(false),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const workoutTemplateSchema = z.object({
  id,
  name: z.string().min(1, 'Name darf nicht leer sein'),
  description: z.string().default(''),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const templateExerciseSchema = z.object({
  id,
  templateId: id,
  exerciseId: id,
  order: z.number().int().min(0),
  targetSets: z.number().int().min(1).max(50).default(3),
  targetRepMin: z.number().int().min(0).max(1000).optional(),
  targetRepMax: z.number().int().min(0).max(1000).optional(),
  targetDurationSeconds: z.number().int().min(0).max(36000).optional(),
  restSeconds: z.number().int().min(0).max(3600).default(120),
  notes: z.string().default(''),
  ...groupingFields,
});

export const workoutSessionSchema = z.object({
  id,
  templateId: id.optional(),
  name: z.string().default('Training'),
  status: z.enum(['active', 'completed']),
  startedAt: isoDateTime,
  finishedAt: isoDateTime.optional(),
  notes: z.string().default(''),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const sessionExerciseSchema = z.object({
  id,
  sessionId: id,
  exerciseId: id,
  order: z.number().int().min(0),
  exerciseNameSnapshot: z.string().min(1),
  trackingTypeSnapshot: trackingTypeSchema,
  weightModeSnapshot: weightModeSchema,
  weightMultiplierSnapshot: z.number().positive().max(10).default(1),
  // Added in schema version 4. Defaulted rather than required so backups
  // written by older versions of the app still validate and import cleanly.
  restSecondsSnapshot: z.number().int().min(0).max(3600).default(120),
  targetSetsSnapshot: z.number().int().min(1).max(50).optional(),
  notes: z.string().default(''),
  ...groupingFields,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const workoutSetSchema = z.object({
  id,
  sessionExerciseId: id,
  position: z.number().int().min(0),
  setType: setTypeSchema,
  weightKg: z.number().min(0, 'Gewicht darf nicht negativ sein').max(1000).optional(),
  reps: z.number().int('Wiederholungen müssen ganzzahlig sein').min(0).max(10000).optional(),
  durationSeconds: z.number().min(0, 'Dauer darf nicht negativ sein').max(86400).optional(),
  rir: z.number().min(0).max(10).optional(),
  rpe: z.number().min(1).max(10).optional(),
  restTargetSeconds: z.number().int().min(0).max(3600).default(0),
  restStartedAt: isoDateTime.optional(),
  restEndedAt: isoDateTime.optional(),
  restActualSeconds: z.number().min(0).max(86400).optional(),
  completedAt: isoDateTime.optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

/** A single circumference, in centimetres. */
const measurementCm = z.number().positive().max(300).optional();

export const bodyMeasurementsSchema = z.object({
  neckCm: measurementCm,
  shoulderCm: measurementCm,
  chestCm: measurementCm,
  waistCm: measurementCm,
  hipCm: measurementCm,
  bicepsLeftCm: measurementCm,
  bicepsRightCm: measurementCm,
  forearmLeftCm: measurementCm,
  forearmRightCm: measurementCm,
  thighLeftCm: measurementCm,
  thighRightCm: measurementCm,
  calfLeftCm: measurementCm,
  calfRightCm: measurementCm,
});

export const bodyWeightEntrySchema = z.object({
  id,
  date: isoDate,
  // Optional since version 3: an entry may record only measurements.
  weightKg: z.number().positive('Körpergewicht muss größer als 0 sein').max(700).optional(),
  bodyFatPercent: z.number().positive().max(70).optional(),
  measurements: bodyMeasurementsSchema.optional(),
  notes: z.string().default(''),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const appSettingsSchema = z.object({
  id: z.literal('app-settings'),
  unit: z.literal('kg').default('kg'),
  defaultRestSeconds: z.number().int().min(0).max(3600).default(120),
  defaultAnalyticsRange: z.enum(['7d', '30d', '90d', 'all', 'custom']).default('30d'),
  darkMode: z.enum(['dark', 'light', 'system']).default('dark'),
  restSoundEnabled: z.boolean().default(true),
  restVibrationEnabled: z.boolean().default(true),
  // Added in schema version 5; defaulted so older backups still validate.
  keepScreenAwake: z.boolean().default(true),
  analysisContext: z
    .object({
      goal: z.string().max(300).optional(),
      trainingDaysPerWeekTarget: z.number().int().min(1).max(14).optional(),
      equipment: z.string().max(500).optional(),
      phase: z.enum(['bulk', 'maintenance', 'cut']).optional(),
      limitations: z.string().max(1000).optional(),
      focus: z.string().max(500).optional(),
    })
    .optional(),
  // Added in schema version 7; optional so older backups still validate.
  weeklyGoals: z
    .object({
      sessionsPerWeek: z.number().int().min(1).max(14).optional(),
      workingSetsPerWeek: z.number().int().min(1).max(500).optional(),
      exerciseGoals: z
        .array(
          z.object({
            exerciseId: id,
            exerciseNameSnapshot: z.string().min(1),
            sessionsPerWeek: z.number().int().min(1).max(14).optional(),
            workingSetsPerWeek: z.number().int().min(1).max(200).optional(),
          }),
        )
        .max(50)
        .optional(),
    })
    .optional(),
  backupReminderDays: z.number().int().min(0).max(365).default(14),
  lastBackupAt: isoDateTime.optional(),
  schemaVersion: z.number().int().min(1).default(1),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
