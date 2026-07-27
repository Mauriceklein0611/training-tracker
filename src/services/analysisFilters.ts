import type { AnalyticsDataset } from '@/services/analytics';
import { computeBlockMetrics, type BlockMetrics } from '@/services/blockComparison';
import type { BodyWeightEntry, PlanUsagePeriod, WorkoutSession } from '@/types';
import { dayKey, type DateRange } from '@/utils/date';

/**
 * Deload- and plan-aware analysis filters (Phase 6).
 *
 * These reuse the existing analytics engine — they only narrow the dataset
 * before it is summarised, never compute a second set of metrics. A deliberate
 * deload must not read as a plateau, so it can be excluded or shown on its own;
 * a plan comparison simply scopes the dataset to each plan's sessions.
 */

/** How deload sessions are treated in an analysis view. */
export type DeloadFilter = 'include' | 'exclude' | 'only';

export const DELOAD_FILTER_LABELS: Record<DeloadFilter, string> = {
  include: 'Deload einbeziehen',
  exclude: 'Deload ausblenden',
  only: 'Nur Deload',
};

/** Whether a session is a deload session (Phase 5 marker). */
export function isDeloadSession(session: WorkoutSession): boolean {
  return session.deloadIntensity != null;
}

export function filterSessionsByDeload(
  sessions: WorkoutSession[],
  filter: DeloadFilter,
): WorkoutSession[] {
  if (filter === 'include') return sessions;
  if (filter === 'only') return sessions.filter(isDeloadSession);
  return sessions.filter((session) => !isDeloadSession(session));
}

/**
 * Narrows a dataset to a subset of sessions, pruning the dependent
 * session-exercises and sets so the analytics engine stays consistent. Exercises
 * are kept as-is (they are reference data, not per-session).
 */
export function restrictDatasetToSessions(
  dataset: AnalyticsDataset,
  keptSessionIds: Set<string>,
): AnalyticsDataset {
  const sessions = dataset.sessions.filter((session) => keptSessionIds.has(session.id));
  const sessionExercises = dataset.sessionExercises.filter((entry) =>
    keptSessionIds.has(entry.sessionId),
  );
  const keptExerciseIds = new Set(sessionExercises.map((entry) => entry.id));
  const sets = dataset.sets.filter((set) => keptExerciseIds.has(set.sessionExerciseId));
  return { sessions, sessionExercises, sets, exercises: dataset.exercises };
}

/** Dataset scoped to one plan's sessions (by the planId snapshot). */
export function filterDatasetByPlan(
  dataset: AnalyticsDataset,
  planId: string,
): AnalyticsDataset {
  const keptSessionIds = new Set(
    dataset.sessions.filter((session) => session.planId === planId).map((s) => s.id),
  );
  return restrictDatasetToSessions(dataset, keptSessionIds);
}

/** Dataset filtered by how deload sessions should be treated. */
export function filterDatasetByDeload(
  dataset: AnalyticsDataset,
  filter: DeloadFilter,
): AnalyticsDataset {
  if (filter === 'include') return dataset;
  const keptSessionIds = new Set(
    filterSessionsByDeload(dataset.sessions, filter).map((s) => s.id),
  );
  return restrictDatasetToSessions(dataset, keptSessionIds);
}

/** The inclusive local-day span [from, to] of one usage period; open ends today. */
function periodSpans(
  periods: PlanUsagePeriod[],
  planId: string,
  todayKey: string,
): { from: string; to: string }[] {
  return periods
    .filter((period) => period.planId === planId)
    .map((period) => ({ from: period.startDate, to: period.endDate ?? todayKey }));
}

/**
 * The overall span a plan was the active plan, derived from its usage periods
 * (open periods run to today). Returns null when the plan has no usage history,
 * so the caller can fall back rather than invent a range.
 */
export function planUsageSpan(
  periods: PlanUsagePeriod[],
  planId: string,
  today: Date = new Date(),
): { from: string; to: string } | null {
  const spans = periodSpans(periods, planId, dayKey(today));
  if (spans.length === 0) return null;
  return {
    from: spans.reduce((min, span) => (span.from < min ? span.from : min), spans[0].from),
    to: spans.reduce((max, span) => (span.to > max ? span.to : max), spans[0].to),
  };
}

/**
 * Whether two plans' usage periods overlap in time. When they do, a side-by-side
 * comparison cannot attribute a body change to one plan alone, so the UI must say
 * the attribution is uncertain rather than imply causation.
 */
export function planUsagePeriodsOverlap(
  periods: PlanUsagePeriod[],
  planIdA: string,
  planIdB: string,
  today: Date = new Date(),
): boolean {
  const todayKey = dayKey(today);
  const a = periodSpans(periods, planIdA, todayKey);
  const b = periodSpans(periods, planIdB, todayKey);
  // Inclusive day ranges overlap when each starts on or before the other ends.
  return a.some((x) => b.some((y) => x.from <= y.to && y.from <= x.to));
}

export interface PlanComparisonSide {
  planId: string;
  label: string;
  range: DateRange;
  metrics: BlockMetrics;
  /** True when the plan's usage periods overlap another plan's — attribution is
   * then uncertain and the UI should say so rather than imply causation. */
  usageUncertain: boolean;
}

export interface PlanComparisonInput {
  planId: string;
  label: string;
  range: DateRange;
  usageUncertain?: boolean;
}

/**
 * Compares two plans over their own ranges, reusing {@link computeBlockMetrics}
 * on each plan-scoped, deload-filtered dataset. Never asserts that a plan caused
 * a body change; it only reports the numbers side by side.
 */
export function comparePlans(
  dataset: AnalyticsDataset,
  bodyEntries: BodyWeightEntry[],
  a: PlanComparisonInput,
  b: PlanComparisonInput,
  deloadFilter: DeloadFilter = 'include',
  now: Date = new Date(),
): { a: PlanComparisonSide; b: PlanComparisonSide } {
  const side = (input: PlanComparisonInput): PlanComparisonSide => {
    const scoped = filterDatasetByDeload(
      filterDatasetByPlan(dataset, input.planId),
      deloadFilter,
    );
    return {
      planId: input.planId,
      label: input.label,
      range: input.range,
      metrics: computeBlockMetrics(scoped, bodyEntries, input.range, input.label, now),
      usageUncertain: input.usageUncertain ?? false,
    };
  };
  return { a: side(a), b: side(b) };
}
