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
  // Added in schema version 20; optional so older backups still validate and
  // import as custom exercises (absent origin is treated as custom).
  origin: z.enum(['system', 'custom']).optional(),
  catalogKey: z.string().max(80).optional(),
  searchTerms: z.array(z.string().max(60)).max(40).optional(),
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
  // Added in schema version 12; optional, so older backups still validate.
  techniqueCues: z.array(z.string().max(160)).max(12).optional(),
  alternativeExerciseIds: z.array(id).max(20).optional(),
  notes: z.string().default(''),
  archived: z.boolean().default(false),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

/** Added in schema version 17; the parent of one or more training days. */
export const trainingPlanSchema = z.object({
  id,
  name: z.string().min(1, 'Name darf nicht leer sein'),
  description: z.string().default(''),
  splitType: z
    .enum(['single', '2-day', '3-day', '4-day', '5-day', 'custom'])
    .default('single'),
  deloadIntensity: z.enum(['light', 'medium', 'strong']).optional(),
  // Added in schema version 21; all optional plan metadata/goals.
  goalType: z
    .enum(['muscle', 'strength', 'fitness', 'fatloss', 'maintenance', 'custom'])
    .optional(),
  goalText: z.string().max(2000).optional(),
  focusNote: z.string().max(4000).optional(),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  sessionsPerWeekTarget: z.number().int().min(1).max(14).optional(),
  workingSetsPerWeekTarget: z.number().int().min(1).max(500).optional(),
  startDate: isoDate.optional(),
  plannedWeeks: z.number().int().min(1).max(520).optional(),
  focusMuscleGroups: z.array(z.string().max(80)).max(30).optional(),
  restrictions: z.string().max(2000).optional(),
  targetBodyWeightKg: z.number().min(0).max(1000).optional(),
  targetBodyFatPercent: z.number().min(0).max(100).optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

/** Added in schema version 21; a span during which a plan was the active plan. */
export const planUsagePeriodSchema = z.object({
  id,
  planId: id,
  planNameSnapshot: z.string().default(''),
  startDate: isoDate,
  endDate: isoDate.optional(),
  note: z.string().max(2000).optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const workoutTemplateSchema = z.object({
  id,
  // Added in schema version 17; optional so backups written before the split
  // system still validate and are wrapped into a plan on restore.
  planId: id.optional(),
  position: z.number().int().min(0).optional(),
  name: z.string().min(1, 'Name darf nicht leer sein'),
  description: z.string().default(''),
  // Added in schema version 19; the library unit a day was copied from, if any.
  sourceWorkoutUnitTemplateId: id.optional(),
  sourceWorkoutUnitNameSnapshot: z.string().optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

/** Added in schema version 19; a reusable library workout unit ("Übungseinheit"). */
export const workoutUnitTemplateSchema = z.object({
  id,
  name: z.string().min(1, 'Name darf nicht leer sein'),
  description: z.string().default(''),
  archived: z.boolean().default(false),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

/** Added in schema version 19; an exercise inside a library workout unit. */
export const workoutUnitTemplateExerciseSchema = z.object({
  id,
  unitTemplateId: id,
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

/** Added in schema version 18; the time layout of a plan. One per plan. */
export const planScheduleSchema = z.object({
  id,
  planId: id,
  mode: z.enum(['free-rotation', 'repeating-cycle', 'weekly']).default('free-rotation'),
  startDate: isoDate.optional(),
  cyclePosition: z.number().int().min(0).optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

/** Added in schema version 18; one day within a {@link planScheduleSchema}. */
export const scheduleEntrySchema = z.object({
  id,
  scheduleId: id,
  position: z.number().int().min(0),
  type: z.enum(['workout', 'rest']),
  templateId: id.optional(),
  weekday: z.number().int().min(0).max(6).optional(),
  label: z.string().max(120).optional(),
});

export const aiExportRecordSchema = z.object({
  id,
  fingerprint: z.string().default(''),
  createdAt: isoDateTime,
});

export const planImportRecordSchema = z.object({
  id,
  fingerprint: z.string().default(''),
  packageName: z.string().default(''),
  importedAt: isoDateTime,
});

export const equipmentProfileSchema = z.object({
  id,
  name: z.string().min(1, 'Name darf nicht leer sein'),
  equipment: z.array(z.string().max(100)).max(100).default([]),
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

const rating1to5 = z.number().int().min(1).max(5).optional();

export const preCheckInSchema = z.object({
  energy: rating1to5,
  sleepQuality: rating1to5,
  motivation: rating1to5,
  soreness: z.number().int().min(0).max(5).optional(),
  painNote: z.string().max(1000).optional(),
  note: z.string().max(2000).optional(),
});

export const postCheckInSchema = z.object({
  quality: rating1to5,
  difficulty: rating1to5,
  satisfaction: rating1to5,
  note: z.string().max(2000).optional(),
});

export const templateExerciseSnapshotSchema = z.object({
  exerciseId: id,
  exerciseNameSnapshot: z.string().min(1),
  order: z.number().int().min(0),
  targetSets: z.number().int().min(1).max(50).default(3),
  targetRepMin: z.number().int().min(0).max(1000).optional(),
  targetRepMax: z.number().int().min(0).max(1000).optional(),
  targetDurationSeconds: z.number().int().min(0).max(36000).optional(),
  restSeconds: z.number().int().min(0).max(3600).default(120),
  notes: z.string().default(''),
  ...groupingFields,
});

export const templateVersionSchema = z.object({
  id,
  templateId: id,
  versionNumber: z.number().int().min(1),
  label: z.string().default(''),
  source: z.enum(['manual', 'ai-import', 'auto']).default('manual'),
  note: z.string().max(2000).optional(),
  archived: z.boolean().optional(),
  snapshot: z.object({
    name: z.string().default(''),
    description: z.string().default(''),
    exercises: z.array(templateExerciseSnapshotSchema),
  }),
  createdAt: isoDateTime,
});

export const workoutSessionSchema = z.object({
  id,
  templateId: id.optional(),
  // Added in schema version 17; optional so older sessions still validate and
  // fall back to their template/day where these snapshots are absent.
  planId: id.optional(),
  planNameSnapshot: z.string().optional(),
  dayPositionSnapshot: z.number().int().min(0).optional(),
  // Added in schema version 19; set when started directly from a library unit.
  workoutUnitTemplateId: id.optional(),
  workoutUnitNameSnapshot: z.string().optional(),
  name: z.string().default('Training'),
  status: z.enum(['active', 'completed']),
  startedAt: isoDateTime,
  finishedAt: isoDateTime.optional(),
  notes: z.string().default(''),
  // Added in schema version 9; optional so older backups still validate.
  preCheckIn: preCheckInSchema.optional(),
  postCheckIn: postCheckInSchema.optional(),
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
  // Added in schema version 15; all optional, so older backups still validate.
  templateExerciseIdSnapshot: id.optional(),
  targetRepMinSnapshot: z.number().int().min(0).max(1000).optional(),
  targetRepMaxSnapshot: z.number().int().min(0).max(1000).optional(),
  targetDurationSecondsSnapshot: z.number().int().min(0).max(36000).optional(),
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
  reps: z
    .number()
    .int('Wiederholungen müssen ganzzahlig sein')
    .min(0)
    .max(10000)
    .optional(),
  durationSeconds: z
    .number()
    .min(0, 'Dauer darf nicht negativ sein')
    .max(86400)
    .optional(),
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
  weightKg: z
    .number()
    .positive('Körpergewicht muss größer als 0 sein')
    .max(700)
    .optional(),
  bodyFatPercent: z.number().positive().max(70).optional(),
  measurements: bodyMeasurementsSchema.optional(),
  notes: z.string().default(''),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const storedAiProposalSchema = z.object({
  proposalId: z.string().min(1),
  operation: z.enum(['update_template_exercise_target', 'update_template_note']),
  target: z.object({ templateId: id, templateExerciseId: id.optional() }),
  expected: z.record(z.union([z.number(), z.string(), z.null()])).optional(),
  changes: z.record(z.union([z.number(), z.string()])),
  reason: z.string().default(''),
  status: z.enum(['pending', 'applied', 'skipped', 'conflict', 'invalid']),
  issue: z.string().optional(),
  templateName: z.string().optional(),
  exerciseName: z.string().optional(),
});

export const aiAnalysisSchema = z.object({
  id,
  importedAt: isoDateTime,
  exportId: z.string().optional(),
  headline: z.string().optional(),
  summary: z.string().default(''),
  strengths: z.array(z.string()).default([]),
  observations: z
    .array(z.object({ title: z.string().default(''), text: z.string().default('') }))
    .default([]),
  recommendations: z.array(z.string()).default([]),
  nextAnalysisAfter: isoDate.optional(),
  importFingerprint: z.string().default(''),
  proposals: z.array(storedAiProposalSchema).default([]),
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
  // Added in schema version 14; defaulted so older backups still validate.
  voiceAnnouncementsEnabled: z.boolean().default(false),
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
  // Added in schema version 13; optional so older backups still validate.
  activeEquipmentProfileId: z.string().optional(),
  // Added in schema version 21; the active main plan, optional.
  activePlanId: z.string().optional(),
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
