import { dayKey } from '@/utils/date';

/**
 * Pure helpers for the homescreen. Kept apart from the page so the cycle-week
 * arithmetic stays unit-testable and never invents a value: a plan without a
 * start date or a planned duration simply has no cycle week.
 */

/**
 * Which week of the plan's cycle "today" falls in, 1-based, and the planned
 * total. Returns null unless the plan has both a start date and a planned
 * duration — no fabricated "week 1 of ?". The current week is clamped to the
 * planned total so an overrun reads as the last week, not week 9 of 8.
 */
export function planCycleWeek(
  startDate: string | undefined,
  plannedWeeks: number | undefined,
  today: Date = new Date(),
): { current: number; total: number } | null {
  if (!startDate || !plannedWeeks || plannedWeeks <= 0) return null;
  const start = new Date(`${startDate}T00:00:00`);
  const todayKey = dayKey(today);
  const todayMidnight = new Date(`${todayKey}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const days = Math.floor((todayMidnight.getTime() - start.getTime()) / 86400000);
  if (days < 0) return null; // plan starts in the future
  const week = Math.floor(days / 7) + 1;
  return { current: Math.min(week, plannedWeeks), total: plannedWeeks };
}
