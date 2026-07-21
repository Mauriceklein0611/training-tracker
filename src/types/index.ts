/**
 * Central domain types.
 *
 * All dates are stored as ISO-8601 strings (UTC) so that they survive JSON
 * export/import round-trips without timezone ambiguity.
 */

export type ISODateTime = string; // e.g. 2026-07-21T09:15:00.000Z
export type ISODate = string; // e.g. 2026-07-21

/** How a set of an exercise is recorded. */
export type TrackingType =
  /** External weight + repetitions (barbell bench press, dumbbell curls). */
  | 'weight_reps'
  /** Pure bodyweight repetitions, optionally with added weight (pull-ups). */
  | 'bodyweight_reps'
  /** Machine/band assisted bodyweight repetitions (assisted pull-ups). */
  | 'assisted_bodyweight_reps'
  /** Repetitions only, no meaningful load (TRX rows, mobility work). */
  | 'reps_only'
  /** Time under tension / holds (plank, dead hang). */
  | 'duration';

/** Semantics of the number entered in the weight field. */
export type WeightMode =
  /** Weight of a single dumbbell/handle; total load = weight * weightMultiplier. */
  | 'per_hand'
  /** The number already is the total load (barbell incl. bar, machine stack). */
  | 'total'
  /** Extra weight on top of bodyweight (weighted dips). */
  | 'added_weight'
  /** Assistance that reduces the effective load (counterweight machine). */
  | 'assistance'
  /** No weight is recorded at all. */
  | 'none';

export type SetType = 'warmup' | 'working' | 'drop' | 'failure';

export type SessionStatus = 'active' | 'completed';

export interface Exercise {
  id: string;
  name: string;
  primaryMuscleGroup: string;
  secondaryMuscleGroups: string[];
  equipment: string;
  trackingType: TrackingType;
  weightMode: WeightMode;
  /**
   * Factor applied to the entered weight when computing volume.
   * Two dumbbells of 20 kg → multiplier 2 → 40 kg total load.
   */
  weightMultiplier: number;
  defaultRestSeconds: number;
  notes: string;
  /** Archived exercises stay available for history but are hidden from pickers. */
  archived: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  description: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface TemplateExercise {
  id: string;
  templateId: string;
  exerciseId: string;
  order: number;
  targetSets: number;
  targetRepMin?: number;
  targetRepMax?: number;
  targetDurationSeconds?: number;
  restSeconds: number;
  notes: string;
}

export interface WorkoutSession {
  id: string;
  templateId?: string;
  name: string;
  status: SessionStatus;
  startedAt: ISODateTime;
  finishedAt?: ISODateTime;
  notes: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/**
 * An exercise as performed inside a session.
 *
 * The `*Snapshot` fields freeze the exercise configuration at the time of the
 * workout, so renaming or archiving an exercise later never rewrites history.
 */
export interface SessionExercise {
  id: string;
  sessionId: string;
  exerciseId: string;
  order: number;
  exerciseNameSnapshot: string;
  trackingTypeSnapshot: TrackingType;
  weightModeSnapshot: WeightMode;
  weightMultiplierSnapshot: number;
  /**
   * Rest time resolved when the exercise entered this workout (plan target →
   * exercise default → global default). Snapshotted so editing the exercise
   * later cannot change what a past workout prescribed.
   */
  restSecondsSnapshot: number;
  /**
   * Target number of working sets from the plan, if this workout came from one.
   * Undefined for free workouts, where sets are simply added as needed.
   */
  targetSetsSnapshot?: number;
  notes: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface WorkoutSet {
  id: string;
  sessionExerciseId: string;
  position: number;
  setType: SetType;
  weightKg?: number;
  reps?: number;
  durationSeconds?: number;
  /** Reps in reserve, 0–10. */
  rir?: number;
  /** Rate of perceived exertion, 1–10. */
  rpe?: number;
  restTargetSeconds: number;
  /** Absolute timestamps — the rest timer is always derived from these. */
  restStartedAt?: ISODateTime;
  restEndedAt?: ISODateTime;
  restActualSeconds?: number;
  completedAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/**
 * Circumference measurements in centimetres.
 *
 * Every field is optional: most people track two or three of these, not all
 * thirteen. Left and right are kept apart so imbalances stay visible.
 */
export interface BodyMeasurements {
  neckCm?: number;
  shoulderCm?: number;
  chestCm?: number;
  waistCm?: number;
  hipCm?: number;
  bicepsLeftCm?: number;
  bicepsRightCm?: number;
  forearmLeftCm?: number;
  forearmRightCm?: number;
  thighLeftCm?: number;
  thighRightCm?: number;
  calfLeftCm?: number;
  calfRightCm?: number;
}

/**
 * One day of body data.
 *
 * Weight, body fat and the measurements are all optional individually — an
 * entry only has to carry at least one value. This is a diary of what was
 * actually measured; nothing here is ever used to fabricate a kilogram volume
 * for bodyweight exercises.
 */
export interface BodyWeightEntry {
  id: string;
  date: ISODate;
  weightKg?: number;
  bodyFatPercent?: number;
  measurements?: BodyMeasurements;
  notes: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type AnalyticsRangeKey = '7d' | '30d' | '90d' | 'all' | 'custom';

export interface AppSettings {
  /** Singleton row. */
  id: 'app-settings';
  unit: 'kg';
  defaultRestSeconds: number;
  defaultAnalyticsRange: AnalyticsRangeKey;
  darkMode: 'dark' | 'light' | 'system';
  restSoundEnabled: boolean;
  restVibrationEnabled: boolean;
  /** Days after which a backup reminder is shown; 0 disables the reminder. */
  backupReminderDays: number;
  lastBackupAt?: ISODateTime;
  schemaVersion: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** A set enriched with the context needed for any domain calculation. */
export interface SetWithContext {
  set: WorkoutSet;
  sessionExercise: SessionExercise;
  session: WorkoutSession;
}
