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

/** Where an exercise came from: the curated system catalog or the user. */
export type ExerciseOrigin = 'system' | 'custom';

export interface Exercise {
  id: string;
  name: string;
  /**
   * Provenance. `system` exercises come from the curated catalog and carry a
   * stable {@link Exercise.catalogKey}; `custom` ones are user-created. Absent on
   * exercises written before the catalog existed — treated as `custom`.
   */
  origin?: ExerciseOrigin;
  /**
   * Stable, version-independent key for a system exercise, used to seed
   * idempotently (never duplicate on update, never overwrite a user edit).
   * Absent for custom exercises.
   */
  catalogKey?: string;
  /** Extra search terms (German/English synonyms), matched by the exercise search. */
  searchTerms?: string[];
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

/** How many training days a plan starts with; only "single"/"custom" are open-ended. */
export type PlanSplitType = 'single' | '2-day' | '3-day' | '4-day' | '5-day' | 'custom';

/** Deload intensity, shared by the plan-level toggle and the deload service. */
export type DeloadIntensity = 'light' | 'medium' | 'strong';

/** The overarching aim of a training plan. `custom` pairs with a free text. */
export type PlanGoalType =
  'muscle' | 'strength' | 'fitness' | 'fatloss' | 'maintenance' | 'custom';

/** Self-assessed training experience, used only for display and AI context. */
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

/**
 * A time-boxed deload for a plan (Phase 5): a fixed 7-local-day window during
 * which start-time targets are reduced, without ever overwriting the plan's
 * stored values. At most one active period per plan. The concrete reductions are
 * snapshotted so a later change to the defaults never reinterprets a past deload.
 */
export interface PlanDeloadPeriod {
  id: string;
  planId: string;
  intensity: DeloadIntensity;
  /** Local start day (inclusive). */
  startDate: ISODate;
  /** Local end day (inclusive); startDate + 6, or earlier if ended early. */
  endDate: ISODate;
  /** Snapshotted reductions (0..1) and RIR bump applied while active. */
  setReductionPercent: number;
  durationReductionPercent: number;
  addedRir: number;
  /** Set when the user ended the deload before its planned end. */
  endedEarlyAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/**
 * A training plan: the parent of one or more training days ({@link WorkoutTemplate},
 * each holding its own exercises). A plan with a single day behaves exactly like
 * the old one-plan-equals-one-workout model.
 */
export interface TrainingPlan {
  id: string;
  name: string;
  description: string;
  splitType: PlanSplitType;
  /**
   * When set, a deload of this intensity applies to every day of the plan until
   * it is cleared. Non-destructive: the day's stored target sets are untouched
   * and only reduced when a workout is started.
   */
  deloadIntensity?: DeloadIntensity;
  /**
   * Optional plan metadata and goals (Phase 3). All fields are optional and are
   * only ever shown, never used to fabricate an analysis. Goals are target
   * values, never treated as measurements.
   */
  goalType?: PlanGoalType;
  /** Free goal text; the sole detail for `goalType: 'custom'`, optional otherwise. */
  goalText?: string;
  /** Longer focus/notes for the plan. */
  focusNote?: string;
  experienceLevel?: ExperienceLevel;
  /** Intended sessions per week. */
  sessionsPerWeekTarget?: number;
  /** Target number of working sets per week across the plan. */
  workingSetsPerWeekTarget?: number;
  /** Local start day of the plan. */
  startDate?: ISODate;
  /** Intended duration in weeks, if planned. */
  plannedWeeks?: number;
  /** Muscle-group labels the plan focuses on. */
  focusMuscleGroups?: string[];
  /** Free text: injuries, equipment limits, other constraints. */
  restrictions?: string;
  /** Optional body targets — target values only, never a measurement. */
  targetBodyWeightKg?: number;
  targetBodyFatPercent?: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/**
 * A period during which a plan was the actively used main plan (Phase 3).
 *
 * At most one plan is active at a time; activating another closes the previous
 * plan's open period and opens a new one. Usage periods let the analysis
 * attribute body-data change to a plan only over clearly overlapping spans, and
 * survive a plan deletion via the name snapshot.
 */
export interface PlanUsagePeriod {
  id: string;
  planId: string;
  planNameSnapshot: string;
  /** Local start day. */
  startDate: ISODate;
  /** Local end day; absent while this is the open (current) period. */
  endDate?: ISODate;
  note?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** `skip` cancels a planned workout that day; `rest` marks an extra rest day. */
export type PlanScheduleExceptionType = 'skip' | 'rest';

/**
 * A per-day override of a plan's derived schedule (Phase 4). One per plan+date.
 * The schedule itself is unchanged — exceptions only re-colour a single calendar
 * day: a deliberately skipped workout is not counted as "missed", and an extra
 * rest day turns a planned/free day into a pause.
 */
export interface PlanScheduleException {
  id: string;
  planId: string;
  /** Local day (yyyy-MM-dd) this exception applies to. */
  date: ISODate;
  type: PlanScheduleExceptionType;
  /** Optional reason/label shown on the day. */
  note?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/**
 * A single training day within a {@link TrainingPlan} — historically the whole
 * "plan". It owns its exercises via {@link TemplateExercise} and is what a
 * workout session is started from and snapshotted against.
 */
export interface WorkoutTemplate {
  id: string;
  /** Owning plan. Every day belongs to exactly one plan. */
  planId: string;
  name: string;
  description: string;
  /** Stable order of this day within its plan; never derived from the name. */
  position: number;
  /**
   * When this day was created by copying a library workout unit
   * ({@link WorkoutUnitTemplate}), the source unit's id and its name at copy
   * time. Copy-on-add: this day is an independent copy, so later edits to the
   * library unit never change it silently. Absent for days created directly.
   */
  sourceWorkoutUnitTemplateId?: string;
  sourceWorkoutUnitNameSnapshot?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/**
 * A reusable workout unit ("Übungseinheit") in the library — e.g. "Push",
 * "Pull", "Ganzkörper A" — that exists independently of any plan (Phase 1). It
 * owns an ordered list of exercises with target values via
 * {@link WorkoutUnitTemplateExercise}. Adding it to a plan copies it into a
 * plan-internal {@link WorkoutTemplate} (copy-on-add); it can also be started
 * directly as a one-off workout without a plan.
 */
export interface WorkoutUnitTemplate {
  id: string;
  name: string;
  description: string;
  /** Archived units stay available for history/reference but hide from pickers. */
  archived: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/**
 * An exercise inside a library {@link WorkoutUnitTemplate}. Mirrors
 * {@link TemplateExercise} field for field (minus the owning id) so a unit and a
 * plan day carry the exact same target/grouping shape and copy losslessly.
 */
export interface WorkoutUnitTemplateExercise extends ExerciseGrouping {
  id: string;
  unitTemplateId: string;
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
 * How the training days of a plan are laid out over time.
 *
 * - `free-rotation`: the plan's workout units are cycled in a fixed order; a rest
 *   day is simply a day the user does not train, never a stored entry.
 * - `repeating-cycle`: an explicit, ordered list of days — each a workout unit or
 *   a rest day — that repeats from the start once the last day is reached.
 * - `weekly`: workout units (or rest) are pinned to fixed weekdays (Mon–Sun).
 */
export type ScheduleMode = 'free-rotation' | 'repeating-cycle' | 'weekly';

/**
 * The time layout of a {@link TrainingPlan}. Exactly one per plan; created
 * lazily and by migration. Decouples *when* a unit is trained from *what* the
 * unit is: a {@link WorkoutTemplate} ("Übungseinheit") is a reusable template,
 * a schedule entry places it (or a rest day) into a rotation, cycle or week.
 */
export interface PlanSchedule {
  id: string;
  /** Owning plan; one schedule per plan. */
  planId: string;
  mode: ScheduleMode;
  /** Optional anchor date, e.g. the first day of a repeating cycle. */
  startDate?: ISODate;
  /**
   * Cursor into the ordered entries, used only by `repeating-cycle`: the index
   * of the day that is "up next". Completing that day or skipping a rest day
   * advances it; it wraps around. Absent/ignored for the other two modes, whose
   * next day is derived (from completed sessions or the weekday).
   */
  cyclePosition?: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Whether a schedule day is a training day or a deliberate rest day. */
export type ScheduleEntryType = 'workout' | 'rest';

/**
 * One day inside a {@link PlanSchedule}. A `workout` entry references a reusable
 * workout unit by its stable id ({@link WorkoutTemplate.id}); the same unit may
 * appear more than once in a cycle. A `rest` entry is a planned pause and
 * references no unit.
 */
export interface ScheduleEntry {
  id: string;
  scheduleId: string;
  /** Stable order within the schedule. In `weekly` mode this equals `weekday`. */
  position: number;
  type: ScheduleEntryType;
  /** The workout unit for a `workout` entry; absent for a `rest` entry. */
  templateId?: string;
  /** Weekday 0–6 (Mon–Sun) for `weekly` mode; absent otherwise. */
  weekday?: number;
  /** Optional free label, e.g. a custom name for a rest day. */
  label?: string;
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
  /** Restore-point version ids frozen before applying (one per changed plan).
   * Present only when at least one proposal was applied; the basis for undo. */
  restoreVersionIds?: string[];
  /** Set when this import was reverted via the one-point undo. */
  undoneAt?: ISODateTime;
}

/** Lightweight record of a generated AI export, to tie a response back to it. */
export interface AiExportRecord {
  /** The exportId embedded in the exported file. */
  id: string;
  fingerprint: string;
  createdAt: ISODateTime;
}

/** Record of an imported training-plan package, to detect a duplicate import. */
export interface PlanImportRecord {
  id: string;
  /** Content fingerprint of the imported package. */
  fingerprint: string;
  packageName: string;
  importedAt: ISODateTime;
}

export interface WorkoutSession {
  id: string;
  /** The training day (template) this workout was started from, if any. */
  templateId?: string;
  /** The plan the day belonged to at start; snapshotted so later plan edits
   * (rename, move, delete) never rewrite this workout's history. */
  planId?: string;
  planNameSnapshot?: string;
  /** The day's position within its plan at start, for stable historical order. */
  dayPositionSnapshot?: number;
  /**
   * When this workout was started directly from a library workout unit without a
   * plan, the source unit's id and its name at start. Keeps the workout
   * attributable to the unit in analysis even though `planId` is absent.
   */
  workoutUnitTemplateId?: string;
  workoutUnitNameSnapshot?: string;
  /**
   * Set when this workout was started during an active plan deload (Phase 5).
   * Marks the session as a deload so the analysis can include, exclude or show
   * it separately; the effective reduced targets live on the session exercises.
   */
  deloadIntensity?: DeloadIntensity;
  /**
   * Schedule context snapshotted when the workout was started from a plan
   * (Phase 4.4), so the calendar and analysis stay historically correct even
   * after the plan's schedule changes. `plannedDate` is the local day the
   * workout was started for; `scheduleEntryId` links to the cycle/weekly entry
   * it corresponds to, if any. All absent for free workouts and older sessions.
   */
  scheduleModeSnapshot?: ScheduleMode;
  plannedDate?: ISODate;
  scheduleEntryId?: string;
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
  /** The currently active main plan (Phase 3); absent means none is active. */
  activePlanId?: string;
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
