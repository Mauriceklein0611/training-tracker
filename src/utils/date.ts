import {
  addDays,
  differenceInCalendarDays,
  differenceInCalendarWeeks,
  endOfDay,
  endOfWeek,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subWeeks,
} from 'date-fns';
import { de } from 'date-fns/locale';

/** Week starts on Monday, as is customary in Germany. */
const WEEK_OPTIONS = { weekStartsOn: 1 as const, locale: de };

/** Local calendar day key, e.g. "2026-07-21". Used for grouping. */
export function dayKey(value: string | Date): string {
  const date = typeof value === 'string' ? parseISO(value) : value;
  return format(date, 'yyyy-MM-dd');
}

/** Key of the Monday of the week the date belongs to. */
export function weekKey(value: string | Date): string {
  const date = typeof value === 'string' ? parseISO(value) : value;
  return format(startOfWeek(date, WEEK_OPTIONS), 'yyyy-MM-dd');
}

export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? parseISO(value) : value;
  return format(date, 'dd.MM.yyyy', { locale: de });
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === 'string' ? parseISO(value) : value;
  return format(date, 'dd.MM.yyyy, HH:mm', { locale: de });
}

export function formatTime(value: string | Date): string {
  const date = typeof value === 'string' ? parseISO(value) : value;
  return format(date, 'HH:mm', { locale: de });
}

export function formatWeekday(value: string | Date): string {
  const date = typeof value === 'string' ? parseISO(value) : value;
  return format(date, 'EEEE', { locale: de });
}

/**
 * Today as a local calendar day key ("2026-07-21").
 *
 * Always use this instead of `new Date().toISOString().slice(0, 10)`, which
 * yields the *UTC* day: in Central European Summer Time everything after 22:00
 * local time would be filed under the previous day.
 */
export function todayKey(now: Date = new Date()): string {
  return dayKey(now);
}

/** Human readable heading for a day group in the history list. */
export function formatDayHeading(value: string | Date, today: Date = new Date()): string {
  const date = typeof value === 'string' ? parseISO(value) : value;
  const diff = differenceInCalendarDays(today, date);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Gestern';
  return `${formatWeekday(date)}, ${formatDate(date)}`;
}

export interface DateRange {
  from: Date;
  to: Date;
}

/** Inclusive range covering the last `days` calendar days, including today. */
export function lastDaysRange(days: number, now: Date = new Date()): DateRange {
  return { from: startOfDay(subDays(now, days - 1)), to: endOfDay(now) };
}

export function customRange(fromISO: string, toISO: string): DateRange {
  return { from: startOfDay(parseISO(fromISO)), to: endOfDay(parseISO(toISO)) };
}

export function isWithinRange(value: string | Date, range: DateRange): boolean {
  const date = typeof value === 'string' ? parseISO(value) : value;
  return date.getTime() >= range.from.getTime() && date.getTime() <= range.to.getTime();
}

/** Number of calendar weeks the range spans (at least 1). */
export function weeksInRange(range: DateRange): number {
  return Math.max(1, differenceInCalendarWeeks(range.to, range.from, WEEK_OPTIONS) + 1);
}

export function daysInRange(range: DateRange): number {
  return Math.max(1, differenceInCalendarDays(range.to, range.from) + 1);
}

/**
 * Divisor for per-week *rates*: the inclusive number of days in the range
 * divided by seven. Unlike {@link weeksInRange} this does not depend on how many
 * calendar weeks the range happens to touch, so any exact 28-day window always
 * yields 4. Calendar-week grouping (heatmap, weekly goals, streaks) keeps using
 * {@link weeksInRange} / {@link weekKey}.
 */
export function rateWeeks(range: DateRange): number {
  return daysInRange(range) / 7;
}

/**
 * Longest run of consecutive weeks that contain at least one workout, counted
 * backwards from the current week — the app's definition of a training streak.
 */
export function currentWeeklyStreak(dates: string[], now: Date = new Date()): number {
  if (dates.length === 0) return 0;
  const weeks = new Set(dates.map((date) => weekKey(date)));

  let streak = 0;
  let cursor = startOfWeek(now, WEEK_OPTIONS);
  // A week that has just begun should not break the streak.
  if (!weeks.has(format(cursor, 'yyyy-MM-dd'))) {
    cursor = subDays(cursor, 7);
  }
  while (weeks.has(format(cursor, 'yyyy-MM-dd'))) {
    streak += 1;
    cursor = subDays(cursor, 7);
  }
  return streak;
}

/** Monday (local) of the week the value belongs to, as a Date. */
export function startOfWeekDate(value: string | Date = new Date()): Date {
  const date = typeof value === 'string' ? parseISO(value) : value;
  return startOfWeek(date, WEEK_OPTIONS);
}

/** Sunday (local, end of day) of the week the value belongs to, as a Date. */
export function endOfWeekDate(value: string | Date = new Date()): Date {
  const date = typeof value === 'string' ? parseISO(value) : value;
  return endOfWeek(date, WEEK_OPTIONS);
}

/**
 * Week keys (Monday) for the last `count` calendar weeks, oldest first and
 * ending with the current week. Used for weekly goal and heatmap timelines.
 */
export function recentWeekStarts(count: number, now: Date = new Date()): string[] {
  const thisWeek = startOfWeek(now, WEEK_OPTIONS);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    keys.push(format(subWeeks(thisWeek, i), 'yyyy-MM-dd'));
  }
  return keys;
}

/** Short week label like "22.06." for the Monday of a week key. */
export function formatWeekLabel(weekStartKey: string): string {
  return format(parseISO(weekStartKey), 'dd.MM.', { locale: de });
}

/** Human range label like "22.–28.06." for a week. */
export function formatWeekRange(weekStartKey: string): string {
  const start = parseISO(weekStartKey);
  const end = endOfWeek(start, WEEK_OPTIONS);
  return `${format(start, 'dd.', { locale: de })}–${format(end, 'dd.MM.', { locale: de })}`;
}

/**
 * The calendar grid for a month: every day from the Monday on or before the
 * first of the month to the Sunday on or after the last, as day keys grouped
 * into weeks of seven.
 */
export function monthGridDays(anchor: Date): Date[][] {
  const first = startOfMonth(anchor);
  const gridStart = startOfWeek(first, WEEK_OPTIONS);
  const weeks: Date[][] = [];
  // Six rows always cover any month; trailing weeks fully in the next month are
  // dropped so the grid never shows an empty extra row.
  for (let week = 0; week < 6; week += 1) {
    const row: Date[] = [];
    for (let day = 0; day < 7; day += 1) {
      row.push(addDays(gridStart, week * 7 + day));
    }
    if (row.every((date) => date.getMonth() !== first.getMonth() && date > first)) break;
    weeks.push(row);
  }
  return weeks;
}

export function formatMonthTitle(anchor: Date): string {
  return format(anchor, 'MMMM yyyy', { locale: de });
}

/** Formats a duration in seconds as "1:05:03" or "5:03". */
export function formatDuration(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? '-' : '';
  const abs = Math.abs(Math.round(totalSeconds));
  const hours = Math.floor(abs / 3600);
  const minutes = Math.floor((abs % 3600) / 60);
  const seconds = abs % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  return `${sign}${hours > 0 ? `${hours}:` : ''}${mm}:${String(seconds).padStart(2, '0')}`;
}

/** Compact duration for summaries: "1 h 12 min" / "45 min". */
export function formatDurationLong(totalSeconds: number): string {
  const abs = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(abs / 3600);
  const minutes = Math.round((abs % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${String(minutes).padStart(2, '0')} min`;
}

export { startOfDay, endOfDay, parseISO };
