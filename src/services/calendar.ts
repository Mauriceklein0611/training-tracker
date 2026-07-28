import type { AnalyticsDataset } from '@/services/analytics';
import { buildSetContexts } from '@/services/analytics';
import { isCardio, isCompleted, isWorkingSet, setVolumeKg } from '@/services/metrics';
import type { ExerciseWeeklyGoal, WeeklyGoals } from '@/types';
import { dayKey, recentWeekStarts, weekKey } from '@/utils/date';

/**
 * Calendar and weekly-goal aggregation.
 *
 * Pure functions over an already loaded {@link AnalyticsDataset}. Every date is
 * bucketed with the local-calendar helpers (`dayKey`, `weekKey`), so a workout
 * logged at 23:30 in German time counts for that local day, never the UTC one.
 *
 * Only completed sessions are considered — a running workout must not colour the
 * calendar or move a weekly goal while it is still being recorded.
 */

export interface DayActivity {
  /** Local day key, e.g. "2026-07-21". */
  day: string;
  /** Completed sessions started on this day. */
  sessionCount: number;
  /** Completed working sets performed on this day (strength and cardio). */
  workingSets: number;
  /** Completed strength working sets only (cardio excluded) — for type colour. */
  strengthSets: number;
  /** Cardio minutes performed on this day. */
  cardioMinutes: number;
  /** Whether any session on this day was a deload session. */
  isDeload: boolean;
  /** Summed session durations in seconds (0 when no session had a finish time). */
  durationSeconds: number;
  /** Kilogram volume from working sets where volume is meaningful. */
  volumeKg: number;
  sessionIds: string[];
}

/** The discipline that colours a calendar day. */
export type DayColorKind = 'deload' | 'strength' | 'cardio' | 'mixed' | 'body' | 'none';

/**
 * How a day should be coloured: deload wins (a planned reduction, marked
 * distinctly), then the disciplines trained, then a body-measurement-only day.
 * Never invents a kind — a day with nothing is 'none'.
 */
export function dayColorKind(
  activity: DayActivity | null | undefined,
  hasBody = false,
): DayColorKind {
  if (!activity || activity.sessionCount === 0) return hasBody ? 'body' : 'none';
  if (activity.isDeload) return 'deload';
  const strength = activity.strengthSets > 0;
  const cardio = activity.cardioMinutes > 0;
  if (strength && cardio) return 'mixed';
  if (cardio) return 'cardio';
  // Strength, or a session with only warm-ups — still a strength day.
  return 'strength';
}

/** Which quantity drives the heatmap colour. */
export type IntensityMetric = 'sessions' | 'sets' | 'duration';

export const INTENSITY_METRIC_LABELS: Record<IntensityMetric, string> = {
  sessions: 'Einheiten',
  sets: 'Sätze',
  duration: 'Dauer',
};

function sessionDurationSeconds(startedAt: string, finishedAt?: string): number {
  if (!finishedAt) return 0;
  const seconds = (new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

/**
 * Buckets all completed training into local calendar days.
 *
 * The map is keyed by day key; days without any training are simply absent
 * rather than present with zeroes, so callers can tell "rest day" apart from
 * "no data" and never render a fake zero.
 */
export function buildDayActivity(dataset: AnalyticsDataset): Map<string, DayActivity> {
  const days = new Map<string, DayActivity>();

  const ensure = (day: string): DayActivity => {
    const existing = days.get(day);
    if (existing) return existing;
    const created: DayActivity = {
      day,
      sessionCount: 0,
      workingSets: 0,
      strengthSets: 0,
      cardioMinutes: 0,
      isDeload: false,
      durationSeconds: 0,
      volumeKg: 0,
      sessionIds: [],
    };
    days.set(day, created);
    return created;
  };

  for (const session of dataset.sessions) {
    if (session.status !== 'completed') continue;
    const activity = ensure(dayKey(session.startedAt));
    activity.sessionCount += 1;
    if (session.deloadIntensity != null) activity.isDeload = true;
    activity.durationSeconds += sessionDurationSeconds(
      session.startedAt,
      session.finishedAt,
    );
    activity.sessionIds.push(session.id);
  }

  for (const context of buildSetContexts(dataset)) {
    if (!isCompleted(context.set)) continue;
    const activity = ensure(dayKey(context.session.startedAt));
    const cardio = isCardio(context.set, context.sessionExercise);
    if (cardio) activity.cardioMinutes += (context.set.durationSeconds ?? 0) / 60;
    if (!isWorkingSet(context.set)) continue;
    // workingSets keeps its established meaning (all working sets); strengthSets
    // and volume are the strength-only figures used for the day's colour.
    activity.workingSets += 1;
    if (!cardio) {
      activity.strengthSets += 1;
      activity.volumeKg += setVolumeKg(context.set, context.sessionExercise) ?? 0;
    }
  }

  return days;
}

export function metricValue(activity: DayActivity, metric: IntensityMetric): number {
  switch (metric) {
    case 'sessions':
      return activity.sessionCount;
    case 'sets':
      return activity.workingSets;
    case 'duration':
      return activity.durationSeconds;
  }
}

export type IntensityLevel = 0 | 1 | 2 | 3 | 4;

/**
 * Maps a value to one of four non-zero intensity steps relative to the busiest
 * day in view. Zero (or negative) always maps to level 0 — no activity.
 */
export function intensityLevel(value: number, maxValue: number): IntensityLevel {
  if (value <= 0) return 0;
  if (maxValue <= 0) return 1;
  const ratio = value / maxValue;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

export interface CalendarCell {
  day: string;
  date: Date;
  dayOfMonth: number;
  inMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
  activity: DayActivity | null;
  level: IntensityLevel;
}

/**
 * Turns a month grid of dates into calendar cells with intensity levels.
 *
 * The colour scale is normalised against the busiest in-month day for the
 * chosen metric, so the shading is meaningful within the month the user looks
 * at rather than against the whole history.
 */
export function buildCalendarCells(
  grid: Date[][],
  activity: Map<string, DayActivity>,
  metric: IntensityMetric,
  anchorMonth: number,
  now: Date = new Date(),
): CalendarCell[][] {
  const todayText = dayKey(now);

  let maxValue = 0;
  for (const week of grid) {
    for (const date of week) {
      if (date.getMonth() !== anchorMonth) continue;
      const dayActivity = activity.get(dayKey(date));
      if (dayActivity) maxValue = Math.max(maxValue, metricValue(dayActivity, metric));
    }
  }

  return grid.map((week) =>
    week.map((date) => {
      const day = dayKey(date);
      const dayActivity = activity.get(day) ?? null;
      const inMonth = date.getMonth() === anchorMonth;
      return {
        day,
        date,
        dayOfMonth: date.getDate(),
        inMonth,
        isToday: day === todayText,
        isFuture: day > todayText,
        activity: dayActivity,
        level: dayActivity
          ? intensityLevel(metricValue(dayActivity, metric), maxValue)
          : 0,
      };
    }),
  );
}

export interface WeekProgress {
  /** Monday of the week, day key. */
  weekStart: string;
  isCurrentWeek: boolean;
  sessions: number;
  workingSets: number;
  /** Cardio minutes completed in the week (from cardio sets only). */
  cardioMinutes: number;
  /** Cardio distance in metres completed in the week. */
  cardioDistanceMeters: number;
  /** Distinct days in the week with at least one completed cardio activity. */
  cardioSessions: number;
}

/**
 * Session and working-set totals for the last `weekCount` calendar weeks,
 * oldest first and ending with the current (still running) week.
 */
export function computeWeekProgress(
  dataset: AnalyticsDataset,
  weekCount: number,
  now: Date = new Date(),
): WeekProgress[] {
  const weekKeys = recentWeekStarts(weekCount, now);
  const currentWeek = weekKeys[weekKeys.length - 1];
  const byWeek = new Map<string, WeekProgress>();
  const cardioDaysByWeek = new Map<string, Set<string>>();
  for (const week of weekKeys) {
    byWeek.set(week, {
      weekStart: week,
      isCurrentWeek: week === currentWeek,
      sessions: 0,
      workingSets: 0,
      cardioMinutes: 0,
      cardioDistanceMeters: 0,
      cardioSessions: 0,
    });
  }

  for (const session of dataset.sessions) {
    if (session.status !== 'completed') continue;
    const entry = byWeek.get(weekKey(session.startedAt));
    if (entry) entry.sessions += 1;
  }

  for (const context of buildSetContexts(dataset)) {
    if (!isCompleted(context.set)) continue;
    const week = weekKey(context.session.startedAt);
    const entry = byWeek.get(week);
    if (!entry) continue;
    // Cardio is counted apart from strength working sets.
    if (isCardio(context.set, context.sessionExercise)) {
      entry.cardioMinutes += (context.set.durationSeconds ?? 0) / 60;
      entry.cardioDistanceMeters += context.set.distanceMeters ?? 0;
      const days = cardioDaysByWeek.get(week) ?? new Set<string>();
      days.add(dayKey(context.session.startedAt));
      cardioDaysByWeek.set(week, days);
    } else if (isWorkingSet(context.set)) {
      entry.workingSets += 1;
    }
  }
  for (const [week, days] of cardioDaysByWeek) {
    const entry = byWeek.get(week);
    if (entry) entry.cardioSessions = days.size;
  }

  return weekKeys.map((week) => byWeek.get(week) as WeekProgress);
}

export interface ExerciseGoalProgress {
  goal: ExerciseWeeklyGoal;
  /** Distinct completed sessions in the current week that used this exercise. */
  sessions: number;
  /** Working sets of this exercise in the current week. */
  workingSets: number;
}

/**
 * Progress towards each per-exercise goal in the current calendar week only —
 * the running week is where nudging towards a goal is useful; finished weeks are
 * shown as history, not as targets to still hit.
 */
export function computeCurrentWeekExerciseProgress(
  dataset: AnalyticsDataset,
  goals: ExerciseWeeklyGoal[],
  now: Date = new Date(),
): ExerciseGoalProgress[] {
  const currentWeek = weekKey(now);
  const sessionsByExercise = new Map<string, Set<string>>();
  const setsByExercise = new Map<string, number>();

  for (const context of buildSetContexts(dataset)) {
    if (weekKey(context.session.startedAt) !== currentWeek) continue;
    if (!isCompleted(context.set) || !isWorkingSet(context.set)) continue;
    const exerciseId = context.sessionExercise.exerciseId;
    const sessions = sessionsByExercise.get(exerciseId) ?? new Set<string>();
    sessions.add(context.session.id);
    sessionsByExercise.set(exerciseId, sessions);
    setsByExercise.set(exerciseId, (setsByExercise.get(exerciseId) ?? 0) + 1);
  }

  return goals.map((goal) => ({
    goal,
    sessions: sessionsByExercise.get(goal.exerciseId)?.size ?? 0,
    workingSets: setsByExercise.get(goal.exerciseId) ?? 0,
  }));
}

/** Whether an actual count reaches an optional goal (no goal ⇒ nothing to reach). */
export function goalReached(actual: number, goal: number | undefined): boolean {
  return goal != null && actual >= goal;
}

/** True when the settings contain at least one usable goal. */
export function hasAnyWeeklyGoal(goals: WeeklyGoals | undefined): boolean {
  if (!goals) return false;
  if (
    goals.sessionsPerWeek != null ||
    goals.workingSetsPerWeek != null ||
    goals.cardioMinutesPerWeek != null ||
    goals.cardioDistancePerWeekMeters != null ||
    goals.cardioSessionsPerWeek != null
  ) {
    return true;
  }
  return (goals.exerciseGoals ?? []).some(
    (goal) => goal.sessionsPerWeek != null || goal.workingSetsPerWeek != null,
  );
}
