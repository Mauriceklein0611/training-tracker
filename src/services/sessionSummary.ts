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

  const end = session.finishedAt ? new Date(session.finishedAt) : now;
  const durationSeconds = Math.max(
    0,
    (end.getTime() - new Date(session.startedAt).getTime()) / 1000,
  );

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
  };
}
