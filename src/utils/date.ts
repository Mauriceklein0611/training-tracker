import {
  differenceInCalendarDays,
  differenceInCalendarWeeks,
  endOfDay,
  format,
  parseISO,
  startOfDay,
  startOfWeek,
  subDays,
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
