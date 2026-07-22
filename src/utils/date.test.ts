import { describe, expect, it } from 'vitest';
import {
  currentWeeklyStreak,
  customRange,
  dayKey,
  daysInRange,
  formatDuration,
  formatDurationLong,
  isWithinRange,
  lastDaysRange,
  rateWeeks,
  todayKey,
  weekKey,
  weeksInRange,
} from '@/utils/date';

describe('day and week aggregation', () => {
  it('groups by local calendar day', () => {
    expect(dayKey('2026-07-21T09:30:00.000Z')).toMatch(/^2026-07-2[01]$/);
  });

  it('maps every day of a week to the same Monday key', () => {
    // 2026-07-20 is a Monday; the whole week must collapse onto it.
    const monday = weekKey('2026-07-20T12:00:00');
    expect(weekKey('2026-07-22T12:00:00')).toBe(monday);
    expect(weekKey('2026-07-26T12:00:00')).toBe(monday);
    // The following Monday starts a new bucket.
    expect(weekKey('2026-07-27T12:00:00')).not.toBe(monday);
  });
});

describe('todayKey — local calendar day', () => {
  it('returns the local day, not the UTC day', () => {
    // 23:30 local time. In Central European Summer Time the UTC date is already
    // the next day, so `toISOString().slice(0, 10)` would file this under the
    // wrong day. The local key must stay on the 21st.
    const lateEvening = new Date(2026, 6, 21, 23, 30, 0);
    expect(todayKey(lateEvening)).toBe('2026-07-21');
  });

  it('stays on the local day just after midnight', () => {
    const justAfterMidnight = new Date(2026, 6, 22, 0, 15, 0);
    expect(todayKey(justAfterMidnight)).toBe('2026-07-22');
  });

  it('agrees with dayKey', () => {
    const moment = new Date(2026, 6, 21, 18, 0, 0);
    expect(todayKey(moment)).toBe(dayKey(moment));
  });

  it('pads month and day to two digits', () => {
    expect(todayKey(new Date(2026, 0, 5, 12, 0, 0))).toBe('2026-01-05');
  });
});

describe('ranges', () => {
  const now = new Date('2026-07-21T12:00:00');

  it('includes today in a "last N days" range', () => {
    const range = lastDaysRange(7, now);
    expect(daysInRange(range)).toBe(7);
    expect(isWithinRange(now, range)).toBe(true);
  });

  it('excludes dates before the range', () => {
    const range = lastDaysRange(7, now);
    expect(isWithinRange(new Date('2026-07-14T11:59:00'), range)).toBe(false);
    expect(isWithinRange(new Date('2026-07-15T00:30:00'), range)).toBe(true);
  });

  it('counts the calendar weeks a range spans', () => {
    expect(weeksInRange(lastDaysRange(7, now))).toBeGreaterThanOrEqual(1);
    expect(weeksInRange(lastDaysRange(30, now))).toBeGreaterThanOrEqual(4);
  });

  it('rateWeeks divides the inclusive day span by seven', () => {
    // Any exact 28-day window always divides by 4, regardless of weekday.
    expect(rateWeeks(lastDaysRange(28, now))).toBe(4);
    expect(rateWeeks(lastDaysRange(28, new Date('2026-07-19T12:00:00')))).toBe(4);
    // 14 inclusive days → 2.
    expect(rateWeeks(customRange('2026-07-06', '2026-07-19'))).toBe(2);
  });
});

describe('currentWeeklyStreak', () => {
  const now = new Date('2026-07-22T12:00:00'); // Wednesday

  it('counts consecutive weeks with at least one workout', () => {
    const dates = ['2026-07-21T10:00:00', '2026-07-15T10:00:00', '2026-07-08T10:00:00'];
    expect(currentWeeklyStreak(dates, now)).toBe(3);
  });

  it('does not break the streak just because the current week is still empty', () => {
    const dates = ['2026-07-15T10:00:00', '2026-07-08T10:00:00'];
    expect(currentWeeklyStreak(dates, now)).toBe(2);
  });

  it('stops at a gap', () => {
    const dates = ['2026-07-21T10:00:00', '2026-07-01T10:00:00'];
    expect(currentWeeklyStreak(dates, now)).toBe(1);
  });

  it('is zero without any workouts', () => {
    expect(currentWeeklyStreak([], now)).toBe(0);
  });
});

describe('duration formatting', () => {
  it('formats minutes and seconds', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(5)).toBe('0:05');
  });

  it('adds hours when needed', () => {
    expect(formatDuration(3903)).toBe('1:05:03');
  });

  it('keeps the sign of a negative duration', () => {
    expect(formatDuration(-65)).toBe('-1:05');
  });

  it('formats long durations verbosely', () => {
    expect(formatDurationLong(2700)).toBe('45 min');
    expect(formatDurationLong(4320)).toBe('1 h 12 min');
  });
});
