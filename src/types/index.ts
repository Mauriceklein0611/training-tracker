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

/** How an exercise should preferably be progressed. */
export type ProgressionMethod = 'auto' | 'weight' | 'reps';

/** Kind of grouping applied to consecutive exercises. */
export type GroupType = 'superset' | 'circuit';

/** When the rest timer runs inside a group. */
export type GroupRestMode =
  /** Rest after every exercise, like a normal set. */
  | 'each'
  /** Rest only after a full round through the group. */
  | 'round';

/**
 * Optional grouping shared by consecutive exercises that form a superset or
 * circuit. All members of a group carry the same three fields; absence of
 * `groupId` means the exercise stands on its own — the fully backward
 * compatible default for every template and session written before groups
 * existed.
 */
export interface ExerciseGrouping {
  groupId?: string;
  groupType?: GroupType;
  groupRestMode?: GroupRestMode;
}

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
  /** Smallest sensible load step, used by the progression suggestion. */
  weightIncrementKg?: number;
  /** Weights that can actually be selected, e.g. the dumbbell rack. */
  availableWeightsKg?: number[];
  /** Preferred way to progress; "auto" lets the tracking type decide. */
  progressionMethod?: ProgressionMethod;
  /** Repetitions in reserve aimed for. Higher means easier. */
  targetRir?: number;
  /** A few short, personal technique reminders shown during the workout. */
  techniqueCues?: string[];
  /** Manually chosen substitute exercises, e.g. when equipment is taken. */
  alternativeExerciseIds?: string[];
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

/**
 * A named set of available equipment, e.g. "Zuhause", "Fitnessstudio", "Hotel".
 *
 * When one is active, the exercise picker can hide exercises whose equipment is
 * not available. Exercises without any equipment are always available.
 */
export interface EquipmentProfile {
  id: string;
  name: string;
  /** Allowed equipment names, matched against Exercise.equipment. */
  equipment: string[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface TemplateExercise extends ExerciseGrouping {
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

/**
 * Optional, subjective self-report captured before a workout.
 *
 * Every field is optional so the whole thing can be skipped in a second. These
 * are self-ratings, never medical data, and nothing here is turned into a
 * fabricated "recovery score".
 */
export interface PreWorkoutCheckIn {
  /** Energy level, 1 (low) – 5 (high). */
  energy?: number;
  /** Sleep quality, 1 – 5. */
  sleepQuality?: number;
  /** Motivation, 1 – 5. */
  motivation?: number;
  /** Muscle soreness, 0 (none) – 5 (strong). */
  soreness?: number;
  /** Free text about pain or a limitation. */
  painNote?: string;
  /** Free note. */
  note?: string;
}

/** Optional, subjective self-report captured after a workout. */
export interface PostWorkoutCheckIn {
  /** Perceived training quality, 1 – 5. */
  quality?: number;
  /** Perceived difficulty, 1 – 5. */
  difficulty?: number;
  /** Satisfaction with the session, 1 – 5. */
  satisfaction?: number;
  /** Free note. */
  note?: string;
}

/**
 * Immutable snapshot of one exercise row inside a plan version.
 *
 * Carries the exercise name at snapshot time so a version stays readable even
 * if the underlying exercise is later renamed or deleted, mirroring how
 * sessions snapshot their exercises.
 */
export interface TemplateExerciseSnapshot extends ExerciseGrouping {
  exerciseId: string;
  exerciseNameSnapshot: string;
  order: number;
  targetSets: number;
  targetRepMin?: number;
  targetRepMax?: number;
  targetDurationSeconds?: number;
  restSeconds: number;
  notes: string;
}

/** The full, immutable content of a plan at one point in time. */
export interface TemplateVersionSnapshot {
  name: string;
  description: string;
  exercises: TemplateExerciseSnapshot[];
}

/** How a plan version came to exist. */
export type TemplateVersionSource = 'manual' | 'ai-import' | 'auto';

/**
 * A saved, immutable version of a plan.
 *
 * Editing a plan never overwrites history: a version freezes the plan so it can
 * be viewed, compared and reactivated later. The live, editable plan stays in
 * the ordinary template tables; versions are read-only copies beside it.
 */
export interface TemplateVersion {
  id: string;
  templateId: string;
  /** Incrementing per template, 1-based. */
  versionNumber: number;
  label: string;
  source: TemplateVersionSource;
  note?: string;
  archived?: boolean;
  snapshot: TemplateVersionSnapshot;
  createdAt: ISODateTime;
}

/**
 * Plan changes the app knows how to apply from an AI response. The set is
 * deliberately tiny and every operation targets only editable plan data — never
 * completed trainings, sets or body data.
 */
export type AiProposalOperation =
  'update_template_exercise_target' | 'update_template_note';

/** A single machine-readable change proposed by the AI. */
export interface AiProposal {
  proposalId: string;
  operation: AiProposalOperation;
  target: { templateId: string; templateExerciseId?: string };
  /**
   * Values the AI believed were current, used to detect stale proposals. A null
   * means the field was not set in the plan at export time.
   */
  expected?: Record<string, number | string | null>;
  changes: Record<string, number | string>;
  reason: string;
}

export type AiProposalStatus = 'pending' | 'applied' | 'skipped' | 'conflict' | 'invalid';

/** A proposal enriched with the app's validation verdict and, later, its fate. */
export interface StoredAiProposal extends AiProposal {
  status: AiProposalStatus;
  /** Human-readable reason a proposal is a conflict or invalid. */
  issue?: string;
  /** Plan/exercise names resolved at import time, for display. */
  templateName?: string;
  exerciseName?: string;
}

export interface AiObservation {
  title: string;
  text: string;
}

/**
 * A validated, locally stored AI analysis. Feedback is only ever shown as text;
 * plan changes go through an explicit, previewed confirmation before anything is
 * applied.
 */
export interface AiAnalysis {
  id: string;
  importedAt: ISODateTime;
  exportId?: string;
  headline?: string;
  summary: string;
  strengths: string[];
  observations: AiObservation[];
  recommendations: string[];
  /** ISO date the AI recommends for the next analysis, if given. */
  nextAnalysisAfter?: ISODate;
  /** Hash of the imported file, to detect a duplicate import. */
  importFingerprint: string;
  proposals: StoredAiProposal[];
}

/** Lightweight record of a generated AI export, to tie a response back to it. */
export interface AiExportRecord {
  /** The exportId embedded in the exported file. */
  id: string;
  fingerprint: string;
  createdAt: ISODateTime;
}

export interface WorkoutSession {
  id: string;
  templateId?: string;
  name: string;
  status: SessionStatus;
  startedAt: ISODateTime;
  finishedAt?: ISODateTime;
  notes: string;
  /** Optional pre-workout self-report; absent when skipped. */
  preCheckIn?: PreWorkoutCheckIn;
  /** Optional post-workout self-report; absent when skipped. */
  postCheckIn?: PostWorkoutCheckIn;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/**
 * An exercise as performed inside a session.
 *
 * The `*Snapshot` fields freeze the exercise configuration at the time of the
 * workout, so renaming or archiving an exercise later never rewrites history.
 */
export interface SessionExercise extends ExerciseGrouping {
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
  /**
   * The plan targets frozen when the exercise entered this workout. They keep a
   * running workout stable even if the underlying plan is edited afterwards, and
   * — because they live on each session-exercise row — the same exercise used at
   * two plan positions keeps its own targets. Absent for free workouts and for
   * sessions started before these snapshots existed (a compatible fallback).
   */
  templateExerciseIdSnapshot?: string;
  targetRepMinSnapshot?: number;
  targetRepMaxSnapshot?: number;
  targetDurationSecondsSnapshot?: number;
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

export type TrainingPhase = 'bulk' | 'maintenance' | 'cut';

/**
 * Optional background the user can supply for an external AI analysis.
 *
 * Purely descriptive: nothing here influences any calculation in the app, it is
 * only passed through to the AI export so a model has context it could not
 * infer from the numbers alone. Every field is optional.
 */
export interface AnalysisContext {
  goal?: string;
  trainingDaysPerWeekTarget?: number;
  equipment?: string;
  phase?: TrainingPhase;
  limitations?: string;
  focus?: string;
}

/**
 * Optional weekly target for a single exercise.
 *
 * The name is snapshotted so the goal stays readable even after the exercise is
 * renamed or archived; the id is what the aggregation actually matches on.
 */
export interface ExerciseWeeklyGoal {
  exerciseId: string;
  exerciseNameSnapshot: string;
  /** Distinct training days that include this exercise. */
  sessionsPerWeek?: number;
  /** Working sets of this exercise. */
  workingSetsPerWeek?: number;
}

/**
 * Optional, encouraging weekly targets.
 *
 * Every field is optional: leaving all of them empty simply means "no goals
 * set", which is the default. Goals are never used to alter training data and
 * are only ever shown as gentle progress, never as a deficit or a penalty.
 */
export interface WeeklyGoals {
  /** Training sessions (distinct training days) per calendar week. */
  sessionsPerWeek?: number;
  /** Total working sets per calendar week. */
  workingSetsPerWeek?: number;
  /** Per-exercise weekly targets. */
  exerciseGoals?: ExerciseWeeklyGoal[];
}

export interface AppSettings {
  /** Singleton row. */
  id: 'app-settings';
  unit: 'kg';
  defaultRestSeconds: number;
  defaultAnalyticsRange: AnalyticsRangeKey;
  darkMode: 'dark' | 'light' | 'system';
  restSoundEnabled: boolean;
  restVibrationEnabled: boolean;
  /** Keep the display on while a workout is running, where supported. */
  keepScreenAwake: boolean;
  /** Announce the end of a rest by voice, where the browser supports it. */
  voiceAnnouncementsEnabled: boolean;
  /** Optional context for the AI export; never used for calculations. */
  analysisContext?: AnalysisContext;
  /** Optional weekly training goals; absent means no goals are set. */
  weeklyGoals?: WeeklyGoals;
  /** Active equipment profile; absent means "all equipment available". */
  activeEquipmentProfileId?: string;
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
