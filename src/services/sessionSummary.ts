import type { AnalyticsDataset } from '@/services/analytics';
import { buildSetContexts } from '@/services/analytics';
import {
  aggregateVolume,
  findNewRecords,
  isCompleted,
  isWorkingSet,
  type NewRecord,
  type VolumeTotals,
} from '@/services/metrics';
import { computeRestStatistics, type RestStatistics } from '@/services/rest';
import {
  estimateSessionCalories,
  resolveBodyWeightKg,
  type CalorieEstimate,
} from '@/services/calories';
import {
  aggregateCardio,
  aggregatePace,
  isCardioSet,
  type CardioTotals,
  type Pace,
} from '@/services/cardioMetrics';
import type { CardioModality, WorkoutSession } from '@/types';

export interface SessionSummary {
  session: WorkoutSession;
  durationSeconds: number | null;
  exerciseCount: number;
  workingSetCount: number;
  totalReps: number;
  volume: VolumeTotals;
  restStatistics: RestStatistics;
  /** Bests achieved in this session that beat every earlier session. */
  newRecords: NewRecord[];
  /** Cardio totals for this session, shown as a separate block. */
  cardio: CardioTotals;
  /** Whether the session contained any completed cardio section. */
  hasCardio: boolean;
  /**
   * Whether the session has any strength content (a working set, reps or kg
   * volume). False for a pure-cardio session, which then leads with cardio.
   */
  hasStrength: boolean;
  /** The single cardio modality of the session, or undefined when mixed/none. */
  cardioModality: CardioModality | undefined;
  /**
   * Session pace/speed — only when every cardio section shares one modality, so
   * a mixed run+row session never reports a meaningless combined pace.
   */
  cardioPace: Pace | null;
  /** Mean RPE across the session's cardio sections, or null when none recorded. */
  cardioAvgRpe: number | null;
  /**
   * Estimated energy of the workout (#44), or null when no body weight was
   * recorded by the day of the session. Always a rough model value, never a
   * measurement — see {@link estimateSessionCalories}.
   */
  calories: CalorieEstimate | null;
  /**
   * Comparison against the most recent earlier session of the *same* plan day or
   * workout unit, or null when there is no comparable prior session (e.g. a free
   * workout, or the first time this unit was trained). Deltas are only set when
   * both sides have a meaningful value.
   */
  previousComparable: PreviousComparable | null;
}

export interface PreviousComparable {
  sessionId: string;
  name: string;
  startedAt: string;
  /** (current − previous) / previous × 100 for kg volume; null when not comparable. */
  volumeDeltaPercent: number | null;
  /** Same, for total cardio duration; null when not comparable. */
  cardioDurationDeltaPercent: number | null;
}

/** Signed percentage change, only when both sides are positive. */
function percentDelta(previous: number, current: number): number | null {
  if (!(previous > 0) || !(current > 0)) return null;
  return ((current - previous) / previous) * 100;
}

/** What makes two sessions comparable: the same plan day or the same library unit. */
function comparableKey(session: WorkoutSession): string | null {
  return session.workoutUnitTemplateId ?? session.templateId ?? null;
}

/**
 * Everything shown on the workout summary screen.
 *
 * Personal bests are determined by comparing this session against the *rest*
 * of the history, so a record is only reported when it genuinely beats what
 * came before.
 */
export function summarizeSession(
  dataset: AnalyticsDataset,
  sessionId: string,
  now: Date = new Date(),
): SessionSummary | null {
  const session = dataset.sessions.find((entry) => entry.id === sessionId);
  if (!session) return null;

  const allContexts = buildSetContexts(dataset, { includeActiveSession: true });
  const sessionContexts = allContexts.filter(
    (context) => context.session.id === sessionId && isCompleted(context.set),
  );
  const historyContexts = allContexts.filter(
    (context) =>
      context.session.id !== sessionId &&
      context.session.status === 'completed' &&
      isCompleted(context.set),
  );

  const workingContexts = sessionContexts.filter((context) => isWorkingSet(context.set));
  const volume = aggregateVolume(
    workingContexts.map(({ set, sessionExercise }) => ({ set, sessionExercise })),
    { includeWarmup: true, requireCompleted: false },
  );

  // Cardio is summarised separately — never merged into the strength totals.
  const cardio = aggregateCardio(
    sessionContexts.map(({ set, sessionExercise }) => ({
      set,
      context: sessionExercise,
    })),
  );

  // A single modality lets us report a session pace; a mixed session (e.g. run
  // + row) reports none rather than an averaged, meaningless number.
  const cardioModalities = new Set(
    sessionContexts
      .filter(({ set, sessionExercise }) => isCardioSet(set, sessionExercise))
      .map(
        ({ set, sessionExercise }) =>
          set.cardioModalitySnapshot ?? sessionExercise.cardioModalitySnapshot,
      ),
  );
  const cardioModality =
    cardioModalities.size === 1 ? [...cardioModalities][0] : undefined;
  const cardioPace = cardioModality
    ? aggregatePace(
        cardioModality,
        cardio.totalDurationSeconds,
        cardio.totalDistanceMeters,
      )
    : null;

  // Mean cardio RPE from the recorded values only (a section without one is
  // never counted as zero), kept apart from any strength effort.
  const cardioRpeValues = sessionContexts
    .filter(({ set, sessionExercise }) => isCardioSet(set, sessionExercise))
    .map(({ set }) => set.rpe)
    .filter((value): value is number => value != null);
  const cardioAvgRpe =
    cardioRpeValues.length > 0
      ? cardioRpeValues.reduce((sum, value) => sum + value, 0) / cardioRpeValues.length
      : null;

  // Energy estimate from the body weight that was valid on the day of the
  // workout, so a later weigh-in never rewrites what a past session reports.
  const setsByExercise = new Map<string, typeof sessionContexts>();
  for (const context of sessionContexts) {
    const list = setsByExercise.get(context.sessionExercise.id);
    if (list) list.push(context);
    else setsByExercise.set(context.sessionExercise.id, [context]);
  }
  const calories = estimateSessionCalories(
    [...setsByExercise.values()].map((contexts) => ({
      sets: contexts.map((context) => context.set),
      context: contexts[0].sessionExercise,
    })),
    resolveBodyWeightKg(dataset.bodyWeightEntries ?? [], session.startedAt),
  );

  const end = session.finishedAt ? new Date(session.finishedAt) : now;
  const durationSeconds = Math.max(
    0,
    (end.getTime() - new Date(session.startedAt).getTime()) / 1000,
  );

  // Comparison to the most recent earlier session of the same plan day / unit.
  const key = comparableKey(session);
  const previous = key
    ? dataset.sessions
        .filter(
          (candidate) =>
            candidate.id !== sessionId &&
            candidate.status === 'completed' &&
            candidate.startedAt < session.startedAt &&
            comparableKey(candidate) === key,
        )
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
    : undefined;

  let previousComparable: PreviousComparable | null = null;
  if (previous) {
    const prevContexts = allContexts.filter(
      (context) => context.session.id === previous.id && isCompleted(context.set),
    );
    const prevVolume = aggregateVolume(
      prevContexts
        .filter((context) => isWorkingSet(context.set))
        .map(({ set, sessionExercise }) => ({ set, sessionExercise })),
      { includeWarmup: true, requireCompleted: false },
    );
    const prevCardio = aggregateCardio(
      prevContexts.map(({ set, sessionExercise }) => ({ set, context: sessionExercise })),
    );
    previousComparable = {
      sessionId: previous.id,
      name: previous.name,
      startedAt: previous.startedAt,
      volumeDeltaPercent: percentDelta(prevVolume.volumeKg, volume.volumeKg),
      cardioDurationDeltaPercent: percentDelta(
        prevCardio.totalDurationSeconds,
        cardio.totalDurationSeconds,
      ),
    };
  }

  return {
    session,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
    exerciseCount: new Set(sessionContexts.map((context) => context.sessionExercise.id))
      .size,
    workingSetCount: volume.setCount,
    totalReps: volume.totalReps,
    volume,
    restStatistics: computeRestStatistics(workingContexts.map((context) => context.set)),
    newRecords: findNewRecords(sessionContexts, historyContexts),
    cardio,
    hasCardio: cardio.activities > 0,
    hasStrength: volume.setCount > 0 || volume.totalReps > 0 || volume.volumeKg > 0,
    cardioModality,
    cardioPace,
    cardioAvgRpe,
    calories,
    previousComparable,
  };
}
