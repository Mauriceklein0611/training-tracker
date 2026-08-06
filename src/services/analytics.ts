import type {
  BodyWeightEntry,
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
  isCardio,
  isCompleted,
  isWorkingSet,
  setVolumeKg,
  type PersonalRecords,
  type VolumeTotals,
} from '@/services/metrics';
import {
  aggregateCardio,
  computeCardioRecords,
  computePace,
  type CardioRecords,
  type CardioTotals,
  type Pace,
} from '@/services/cardioMetrics';
import type { CardioModality } from '@/types';
import { computeRestStatistics, type RestStatistics } from '@/services/rest';
import {
  currentWeeklyStreak,
  dayKey,
  daysInRange,
  endOfDay,
  isWithinRange,
  parseISO,
  rateWeeks,
  startOfDay,
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
  /**
   * Body weight history, used only for the calorie estimate of a workout (#44).
   * Optional: every existing caller that builds a dataset without it keeps
   * working, and a workout without a recorded weight simply shows no estimate.
   */
  bodyWeightEntries?: BodyWeightEntry[];
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
  /**
   * Cardio per session (cardio exercises only; null for strength). Totals are
   * summed over the session's cardio sections; pace is derived from those totals
   * in the modality's convention, never invented when distance is absent.
   */
  cardioDurationSeconds: number | null;
  cardioDistanceMeters: number | null;
  cardioPace: Pace | null;
}

export interface WeeklyPoint {
  week: string;
  volumeKg: number;
  workingSets: number;
  totalReps: number;
  sessions: number;
}

/** One week of cardio totals, for the cardio time-series charts. */
export interface CardioWeeklyPoint {
  week: string;
  minutes: number;
  distanceMeters: number;
  activities: number;
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
  /** Cardio totals for the range, computed apart from every strength metric. */
  cardio: CardioTotals;
  /** Weekly cardio time-series (minutes, distance, activities) for the charts. */
  cardioWeekly: CardioWeeklyPoint[];
  streakWeeks: number;
  /** Share of weeks in the range that contain at least one workout, 0..1. */
  consistency: number;
  /** Sets that carry no kilogram volume — shown as a data-quality note. */
  setsWithoutVolume: number;
}

function sessionDurationSeconds(session: WorkoutSession): number | null {
  if (!session.finishedAt) return null;
  const seconds =
    (new Date(session.finishedAt).getTime() - new Date(session.startedAt).getTime()) /
    1000;
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
  // Strength metrics exclude cardio entirely: cardio must never add to volume,
  // muscle-group load, working-set counts or the strength rest statistics.
  const countedContexts = contexts.filter(
    (context) =>
      isCompleted(context.set) &&
      (includeWarmup || isWorkingSet(context.set)) &&
      !isCardio(context.set, context.sessionExercise),
  );
  // Cardio is aggregated separately from its own completed sets in range.
  const cardioContexts = contexts.filter(
    (context) =>
      isCompleted(context.set) && isCardio(context.set, context.sessionExercise),
  );
  const cardio = aggregateCardio(
    cardioContexts.map(({ set, sessionExercise }) => ({ set, context: sessionExercise })),
  );
  const cardioWeekly = computeCardioWeeklySeries(cardioContexts);

  const sessionsInRange = dataset.sessions.filter(
    (session) =>
      session.status === 'completed' &&
      (!range || isWithinRange(session.startedAt, range)),
  );

  const durations = sessionsInRange
    .map(sessionDurationSeconds)
    .filter((value): value is number => value != null);
  const totalDurationSeconds = durations.reduce((sum, value) => sum + value, 0);

  const trainingDayKeys = new Set(
    sessionsInRange.map((session) => dayKey(session.startedAt)),
  );
  // Calendar weeks drive "share of weeks trained" (consistency); per-week rates
  // use the actual day span / 7 so a 28-day window always divides by 4.
  const calendarWeeks = range ? weeksInRange(range) : weeksSpanned(sessionsInRange);
  const perWeekDivisor = range ? rateWeeks(range) : spannedRateWeeks(sessionsInRange);

  const volume = aggregateVolume(
    countedContexts.map(({ set, sessionExercise }) => ({ set, sessionExercise })),
    { includeWarmup: true, requireCompleted: false },
  );

  const exercisesById = new Map(
    dataset.exercises.map((exercise) => [exercise.id, exercise]),
  );

  return {
    range,
    sessionCount: sessionsInRange.length,
    trainingDays: trainingDayKeys.size,
    trainingDaysPerWeek: perWeekDivisor > 0 ? trainingDayKeys.size / perWeekDivisor : 0,
    totalDurationSeconds,
    averageDurationSeconds:
      durations.length > 0 ? totalDurationSeconds / durations.length : null,
    workingSetCount: volume.setCount,
    totalReps: volume.totalReps,
    volume,
    muscleGroups: computeMuscleGroupLoad(countedContexts, exercisesById),
    weekly: computeWeeklySeries(countedContexts, sessionsInRange),
    restStatistics: computeRestStatistics(countedContexts.map((context) => context.set)),
    cardio,
    cardioWeekly,
    personalRecords: [
      ...computePersonalRecords(contexts, { includeWarmup }).values(),
    ].sort((a, b) => a.exerciseName.localeCompare(b.exerciseName, 'de')),
    streakWeeks: currentWeeklyStreak(
      dataset.sessions
        .filter((session) => session.status === 'completed')
        .map((session) => session.startedAt),
      now,
    ),
    consistency:
      calendarWeeks > 0 ? countTrainingWeeks(sessionsInRange) / calendarWeeks : 0,
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

/**
 * Per-week rate divisor for the whole history: the inclusive local-day span from
 * the first to the last workout divided by seven — consistent with fixed ranges
 * (a 28-day span always divides by 4). Using this instead of `weeksSpanned`
 * (which rounds whole weeks up) keeps training frequencies from reading too low.
 */
function spannedRateWeeks(sessions: WorkoutSession[]): number {
  if (sessions.length === 0) return 1;
  const sorted = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const from = startOfDay(parseISO(sorted[0].startedAt));
  const to = endOfDay(parseISO(sorted[sorted.length - 1].startedAt));
  return Math.max(1, daysInRange({ from, to }) / 7);
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
    (a, b) =>
      b.directSets - a.directSets || a.muscleGroup.localeCompare(b.muscleGroup, 'de'),
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
    const created: WeeklyPoint = {
      week,
      volumeKg: 0,
      workingSets: 0,
      totalReps: 0,
      sessions: 0,
    };
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
 * Weekly cardio totals (minutes, distance, activities) over the given completed
 * cardio contexts. Kept apart from {@link computeWeeklySeries} so cardio minutes
 * and strength volume never share an axis.
 */
export function computeCardioWeeklySeries(
  cardioContexts: SetWithContext[],
): CardioWeeklyPoint[] {
  const byWeek = new Map<string, CardioWeeklyPoint>();
  for (const { set, session } of cardioContexts) {
    const week = weekKey(session.startedAt);
    const point = byWeek.get(week) ?? {
      week,
      minutes: 0,
      distanceMeters: 0,
      activities: 0,
    };
    point.minutes += (set.durationSeconds ?? 0) / 60;
    point.distanceMeters += set.distanceMeters ?? 0;
    point.activities += 1;
    byWeek.set(week, point);
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
    // Cardio aggregates for the session, kept apart from the strength figures.
    let cardioDurationSeconds = 0;
    let cardioDistanceMeters = 0;
    let hasCardio = false;
    let cardioModality = entries[0].sessionExercise.cardioModalitySnapshot;

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
      if (set.reps != null && (bestReps == null || set.reps > bestReps))
        bestReps = set.reps;
      if (
        set.durationSeconds != null &&
        (maxDurationSeconds == null || set.durationSeconds > maxDurationSeconds)
      ) {
        maxDurationSeconds = set.durationSeconds;
      }
      if (isCardio(set, sessionExercise)) {
        hasCardio = true;
        cardioModality = set.cardioModalitySnapshot ?? cardioModality;
        if (set.durationSeconds != null) cardioDurationSeconds += set.durationSeconds;
        if (set.distanceMeters != null) cardioDistanceMeters += set.distanceMeters;
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
      cardioDurationSeconds: hasCardio ? cardioDurationSeconds : null,
      cardioDistanceMeters: hasCardio ? cardioDistanceMeters : null,
      cardioPace: hasCardio
        ? computePace(cardioModality, cardioDurationSeconds, cardioDistanceMeters)
        : null,
    });
  }

  return points.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

/**
 * Cardio bests for one exercise, with the modality needed to format them. All
 * of the exercise's completed cardio sets are compared — but only within this
 * one exercise (hence one modality), so a short run is never weighed against a
 * long ride. Returns null when the exercise has no completed cardio sections.
 */
export function computeExerciseCardioRecords(
  dataset: AnalyticsDataset,
  exerciseId: string,
  range: DateRange | null = null,
): { modality: CardioModality | undefined; records: CardioRecords } | null {
  const contexts = filterContextsByRange(buildSetContexts(dataset), range).filter(
    (context) =>
      context.sessionExercise.exerciseId === exerciseId &&
      isCompleted(context.set) &&
      isCardio(context.set, context.sessionExercise),
  );
  if (contexts.length === 0) return null;
  const last = contexts[contexts.length - 1];
  const modality =
    last.set.cardioModalitySnapshot ?? last.sessionExercise.cardioModalitySnapshot;
  const records = computeCardioRecords(
    modality,
    contexts.map((context) => ({ set: context.set, context: context.sessionExercise })),
  );
  return { modality, records };
}

/** Exercises that appear in the data, for the progression picker. */
export function listTrackedExercises(
  dataset: AnalyticsDataset,
): { id: string; name: string; trackingType: TrackingType }[] {
  const seen = new Map<
    string,
    { id: string; name: string; trackingType: TrackingType }
  >();
  for (const entry of dataset.sessionExercises) {
    seen.set(entry.exerciseId, {
      id: entry.exerciseId,
      name: entry.exerciseNameSnapshot,
      trackingType: entry.trackingTypeSnapshot,
    });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
