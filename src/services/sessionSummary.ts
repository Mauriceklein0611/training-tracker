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
import type { WorkoutSession } from '@/types';

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

  const end = session.finishedAt ? new Date(session.finishedAt) : now;
  const durationSeconds = Math.max(
    0,
    (end.getTime() - new Date(session.startedAt).getTime()) / 1000,
  );

  return {
    session,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
    exerciseCount: new Set(sessionContexts.map((context) => context.sessionExercise.id)).size,
    workingSetCount: volume.setCount,
    totalReps: volume.totalReps,
    volume,
    restStatistics: computeRestStatistics(workingContexts.map((context) => context.set)),
    newRecords: findNewRecords(sessionContexts, historyContexts),
  };
}
