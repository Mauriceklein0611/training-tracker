import type {
  Exercise,
  SessionExercise,
  SetWithContext,
  TrackingType,
  WorkoutSession,
  WorkoutSet,
} from '@/types';
import {
  aggregateVolume,
  computePersonalRecords,
  effectiveLoadKg,
  estimatedOneRepMax,
  isCompleted,
  isWorkingSet,
  setVolumeKg,
  type PersonalRecords,
  type VolumeTotals,
} from '@/services/metrics';
import { computeRestStatistics, type RestStatistics } from '@/services/rest';
import {
  currentWeeklyStreak,
  dayKey,
  isWithinRange,
  weekKey,
  weeksInRange,
  type DateRange,
} from '@/utils/date';

/** Everything the analytics engine needs, loaded once from the database. */
export interface AnalyticsDataset {
  sessions: WorkoutSession[];
  sessionExercises: SessionExercise[];
  sets: WorkoutSet[];
  exercises: Exercise[];
}

export const UNASSIGNED_MUSCLE_GROUP = 'Ohne Zuordnung';

/**
 * Joins the flat tables into set/exercise/session triples.
 * Only completed sessions are considered — a running workout must not move the
 * statistics around while it is still being recorded.
 */
export function buildSetContexts(
  dataset: AnalyticsDataset,
  options: { includeActiveSession?: boolean } = {},
): SetWithContext[] {
  const sessionsById = new Map(dataset.sessions.map((session) => [session.id, session]));
  const sessionExercisesById = new Map(
    dataset.sessionExercises.map((entry) => [entry.id, entry]),
  );

  const contexts: SetWithContext[] = [];
  for (const set of dataset.sets) {
    const sessionExercise = sessionExercisesById.get(set.sessionExerciseId);
    if (!sessionExercise) continue;
    const session = sessionsById.get(sessionExercise.sessionId);
    if (!session) continue;
    if (!options.includeActiveSession && session.status !== 'completed') continue;
    contexts.push({ set, sessionExercise, session });
  }
  return contexts;
}

export function filterContextsByRange(
  contexts: SetWithContext[],
  range: DateRange | null,
): SetWithContext[] {
  if (!range) return contexts;
  return contexts.filter((context) => isWithinRange(context.session.startedAt, range));
}

export interface MuscleGroupLoad {
  muscleGroup: string;
  /** Working sets of exercises whose *primary* muscle group this is. */
  directSets: number;
  /** Working sets where this group is listed as a secondary mover. */
  indirectSets: number;
  totalReps: number;
  /** Kilogram volume, only from exercises where volume is meaningful. */
  volumeKg: number;
}

export interface ExerciseSeriesPoint {
  date: string;
  /** Session start, ISO — used for tooltips. */
  startedAt: string;
  volumeKg: number | null;
  topSetLoadKg: number | null;
  topSetReps: number | null;
  estimatedOneRepMax: number | null;
  totalReps: number;
  /** Highest single-set repetitions in the session, regardless of load. */
  bestReps: number | null;
  maxDurationSeconds: number | null;
  workingSets: number;
}

export interface WeeklyPoint {
  week: string;
  volumeKg: number;
  workingSets: number;
  totalReps: number;
  sessions: number;
}

export interface AnalyticsResult {
  range: DateRange | null;
  sessionCount: number;
  /** Distinct calendar days with at least one workout. */
  trainingDays: number;
  trainingDaysPerWeek: number;
  totalDurationSeconds: number;
  averageDurationSeconds: number | null;
  workingSetCount: number;
  totalReps: number;
  volume: VolumeTotals;
  muscleGroups: MuscleGroupLoad[];
  weekly: WeeklyPoint[];
  restStatistics: RestStatistics;
  personalRecords: PersonalRecords[];
  streakWeeks: number;
  /** Share of weeks in the range that contain at least one workout, 0..1. */
  consistency: number;
  /** Sets that carry no kilogram volume — shown as a data-quality note. */
  setsWithoutVolume: number;
}

function sessionDurationSeconds(session: WorkoutSession): number | null {
  if (!session.finishedAt) return null;
  const seconds =
    (new Date(session.finishedAt).getTime() - new Date(session.startedAt).getTime()) / 1000;
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

/**
 * Computes every statistic shown on the analytics page.
 *
 * All numbers come from the local database; nothing is estimated beyond the
 * explicitly labelled Epley 1RM.
 */
export function computeAnalytics(
  dataset: AnalyticsDataset,
  range: DateRange | null,
  options: { includeWarmup?: boolean; now?: Date } = {},
): AnalyticsResult {
  const { includeWarmup = false, now = new Date() } = options;

  const allContexts = buildSetContexts(dataset);
  const contexts = filterContextsByRange(allContexts, range);
  const countedContexts = contexts.filter(
    (context) => isCompleted(context.set) && (includeWarmup || isWorkingSet(context.set)),
  );

  const sessionsInRange = dataset.sessions.filter(
    (session) =>
      session.status === 'completed' && (!range || isWithinRange(session.startedAt, range)),
  );

  const durations = sessionsInRange
    .map(sessionDurationSeconds)
    .filter((value): value is number => value != null);
  const totalDurationSeconds = durations.reduce((sum, value) => sum + value, 0);

  const trainingDayKeys = new Set(sessionsInRange.map((session) => dayKey(session.startedAt)));
  const weeks = range ? weeksInRange(range) : weeksSpanned(sessionsInRange);

  const volume = aggregateVolume(
    countedContexts.map(({ set, sessionExercise }) => ({ set, sessionExercise })),
    { includeWarmup: true, requireCompleted: false },
  );

  const exercisesById = new Map(dataset.exercises.map((exercise) => [exercise.id, exercise]));

  return {
    range,
    sessionCount: sessionsInRange.length,
    trainingDays: trainingDayKeys.size,
    trainingDaysPerWeek: weeks > 0 ? trainingDayKeys.size / weeks : 0,
    totalDurationSeconds,
    averageDurationSeconds: durations.length > 0 ? totalDurationSeconds / durations.length : null,
    workingSetCount: volume.setCount,
    totalReps: volume.totalReps,
    volume,
    muscleGroups: computeMuscleGroupLoad(countedContexts, exercisesById),
    weekly: computeWeeklySeries(countedContexts, sessionsInRange),
    restStatistics: computeRestStatistics(countedContexts.map((context) => context.set)),
    personalRecords: [...computePersonalRecords(contexts, { includeWarmup }).values()].sort((a, b) =>
      a.exerciseName.localeCompare(b.exerciseName, 'de'),
    ),
    streakWeeks: currentWeeklyStreak(
      dataset.sessions
        .filter((session) => session.status === 'completed')
        .map((session) => session.startedAt),
      now,
    ),
    consistency: weeks > 0 ? countTrainingWeeks(sessionsInRange) / weeks : 0,
    setsWithoutVolume: volume.setsWithoutVolume,
  };
}

function weeksSpanned(sessions: WorkoutSession[]): number {
  if (sessions.length === 0) return 1;
  const sorted = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const first = new Date(sorted[0].startedAt).getTime();
  const last = new Date(sorted[sorted.length - 1].startedAt).getTime();
  return Math.max(1, Math.ceil((last - first) / (7 * 24 * 3600 * 1000)) + 1);
}

function countTrainingWeeks(sessions: WorkoutSession[]): number {
  return new Set(sessions.map((session) => weekKey(session.startedAt))).size;
}

export function computeMuscleGroupLoad(
  contexts: SetWithContext[],
  exercisesById: Map<string, Exercise>,
): MuscleGroupLoad[] {
  const byGroup = new Map<string, MuscleGroupLoad>();

  const ensure = (group: string): MuscleGroupLoad => {
    const existing = byGroup.get(group);
    if (existing) return existing;
    const created: MuscleGroupLoad = {
      muscleGroup: group,
      directSets: 0,
      indirectSets: 0,
      totalReps: 0,
      volumeKg: 0,
    };
    byGroup.set(group, created);
    return created;
  };

  for (const { set, sessionExercise } of contexts) {
    const exercise = exercisesById.get(sessionExercise.exerciseId);
    const primary = exercise?.primaryMuscleGroup?.trim() || UNASSIGNED_MUSCLE_GROUP;

    const direct = ensure(primary);
    direct.directSets += 1;
    direct.totalReps += set.reps ?? 0;
    direct.volumeKg += setVolumeKg(set, sessionExercise) ?? 0;

    for (const secondary of exercise?.secondaryMuscleGroups ?? []) {
      const trimmed = secondary.trim();
      if (!trimmed || trimmed === primary) continue;
      ensure(trimmed).indirectSets += 1;
    }
  }

  return [...byGroup.values()].sort(
    (a, b) => b.directSets - a.directSets || a.muscleGroup.localeCompare(b.muscleGroup, 'de'),
  );
}

export function computeWeeklySeries(
  contexts: SetWithContext[],
  sessions: WorkoutSession[],
): WeeklyPoint[] {
  const byWeek = new Map<string, WeeklyPoint>();

  const ensure = (week: string): WeeklyPoint => {
    const existing = byWeek.get(week);
    if (existing) return existing;
    const created: WeeklyPoint = { week, volumeKg: 0, workingSets: 0, totalReps: 0, sessions: 0 };
    byWeek.set(week, created);
    return created;
  };

  for (const { set, sessionExercise, session } of contexts) {
    const point = ensure(weekKey(session.startedAt));
    point.workingSets += 1;
    point.totalReps += set.reps ?? 0;
    point.volumeKg += setVolumeKg(set, sessionExercise) ?? 0;
  }

  for (const session of sessions) {
    ensure(weekKey(session.startedAt)).sessions += 1;
  }

  return [...byWeek.values()].sort((a, b) => a.week.localeCompare(b.week));
}

/**
 * Per-session progression of a single exercise: top set, volume and the
 * estimated 1RM. Points without a meaningful value carry `null` rather than 0,
 * so a chart shows a gap instead of a fake drop to zero.
 */
export function computeExerciseSeries(
  dataset: AnalyticsDataset,
  exerciseId: string,
  range: DateRange | null,
  options: { includeWarmup?: boolean } = {},
): ExerciseSeriesPoint[] {
  const { includeWarmup = false } = options;
  const contexts = filterContextsByRange(buildSetContexts(dataset), range).filter(
    (context) =>
      context.sessionExercise.exerciseId === exerciseId &&
      isCompleted(context.set) &&
      (includeWarmup || isWorkingSet(context.set)),
  );

  const bySession = new Map<string, SetWithContext[]>();
  for (const context of contexts) {
    const list = bySession.get(context.session.id) ?? [];
    list.push(context);
    bySession.set(context.session.id, list);
  }

  const points: ExerciseSeriesPoint[] = [];
  for (const entries of bySession.values()) {
    const session = entries[0].session;
    let volumeKg = 0;
    let hasVolume = false;
    let topSetLoadKg: number | null = null;
    let topSetReps: number | null = null;
    let bestOneRm: number | null = null;
    let totalReps = 0;
    let bestReps: number | null = null;
    let maxDurationSeconds: number | null = null;

    for (const { set, sessionExercise } of entries) {
      const volume = setVolumeKg(set, sessionExercise);
      if (volume != null) {
        volumeKg += volume;
        hasVolume = true;
      }
      const load = effectiveLoadKg(set, sessionExercise);
      if (load != null && (topSetLoadKg == null || load > topSetLoadKg)) {
        topSetLoadKg = load;
        topSetReps = set.reps ?? null;
      }
      const oneRm = estimatedOneRepMax(set, sessionExercise);
      if (oneRm != null && (bestOneRm == null || oneRm > bestOneRm)) bestOneRm = oneRm;
      totalReps += set.reps ?? 0;
      if (set.reps != null && (bestReps == null || set.reps > bestReps)) bestReps = set.reps;
      if (
        set.durationSeconds != null &&
        (maxDurationSeconds == null || set.durationSeconds > maxDurationSeconds)
      ) {
        maxDurationSeconds = set.durationSeconds;
      }
    }

    points.push({
      date: dayKey(session.startedAt),
      startedAt: session.startedAt,
      volumeKg: hasVolume ? volumeKg : null,
      topSetLoadKg,
      topSetReps,
      estimatedOneRepMax: bestOneRm,
      totalReps,
      bestReps,
      maxDurationSeconds,
      workingSets: entries.length,
    });
  }

  return points.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

/** Exercises that appear in the data, for the progression picker. */
export function listTrackedExercises(
  dataset: AnalyticsDataset,
): { id: string; name: string; trackingType: TrackingType }[] {
  const seen = new Map<string, { id: string; name: string; trackingType: TrackingType }>();
  for (const entry of dataset.sessionExercises) {
    seen.set(entry.exerciseId, {
      id: entry.exerciseId,
      name: entry.exerciseNameSnapshot,
      trackingType: entry.trackingTypeSnapshot,
    });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
