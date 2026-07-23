import {
  differenceInCalendarDays,
  isWithinInterval,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import type { WorkoutSession } from '@/types';

/**
 * Pure plan overview metrics (Phase 3).
 *
 * Derives only what completed sessions actually contain — counts, rates and
 * dates — and never fabricates volume or body change. Heavier analytics (volume,
 * muscle distribution) stay in the existing analysis engine; this is the light
 * summary the plan dashboard needs. Weeks are Monday-based local calendar weeks.
 */
export interface PlanOverview {
  sessionCount: number;
  firstSessionAt?: string;
  lastSessionAt?: string;
  /** Completed sessions falling into the current local calendar week. */
  sessionsThisWeek: number;
  /** Intended sessions per week, echoed for the adherence display. */
  weeklyTarget?: number;
  /** Average completed sessions per week over the active span; undefined if none. */
  avgSessionsPerWeek?: number;
  /** Calendar days from the first to the last completed session, inclusive. */
  spanDays?: number;
}

export interface PlanOverviewInput {
  /** Completed sessions attributed to the plan. */
  sessions: WorkoutSession[];
  weeklyTarget?: number;
  today?: Date;
}

function sessionTime(session: WorkoutSession): string {
  return session.finishedAt ?? session.startedAt;
}

export function computePlanOverview(input: PlanOverviewInput): PlanOverview {
  const { sessions, weeklyTarget, today = new Date() } = input;
  if (sessions.length === 0) {
    return { sessionCount: 0, sessionsThisWeek: 0, weeklyTarget };
  }

  const sorted = [...sessions].sort((a, b) =>
    sessionTime(a).localeCompare(sessionTime(b)),
  );
  const first = sessionTime(sorted[0]);
  const last = sessionTime(sorted[sorted.length - 1]);

  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const sessionsThisWeek = sorted.filter((session) =>
    isWithinInterval(new Date(sessionTime(session)), { start: weekStart, end: weekEnd }),
  ).length;

  const spanDays = differenceInCalendarDays(new Date(last), new Date(first)) + 1;
  const weeks = Math.max(1, spanDays / 7);
  const avgSessionsPerWeek = Math.round((sessions.length / weeks) * 10) / 10;

  return {
    sessionCount: sessions.length,
    firstSessionAt: first,
    lastSessionAt: last,
    sessionsThisWeek,
    weeklyTarget,
    avgSessionsPerWeek,
    spanDays,
  };
}
