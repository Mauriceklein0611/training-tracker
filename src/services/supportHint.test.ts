import { describe, expect, it } from 'vitest';
import {
  SUPPORT_HINT_COOLDOWN_DAYS,
  SUPPORT_HINT_MIN_SESSIONS,
  shouldShowSupportHint,
  type SupportHintState,
} from '@/services/supportHint';

const NOW = new Date('2026-07-30T10:00:00');

function state(overrides: Partial<SupportHintState> = {}): SupportHintState {
  return {
    finishedSessions: SUPPORT_HINT_MIN_SESSIONS,
    lastFinishedDayKey: '2026-07-27',
    hasRunningWorkout: false,
    todayDayKey: '2026-07-30',
    now: NOW,
    ...overrides,
  };
}

const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

describe('support hint eligibility', () => {
  it('appears once the usage threshold is reached', () => {
    expect(shouldShowSupportHint(state())).toBe(true);
    expect(shouldShowSupportHint(state({ finishedSessions: 12 }))).toBe(true);
  });

  it('stays hidden before five finished workouts', () => {
    for (const count of [0, 1, 4]) {
      expect(shouldShowSupportHint(state({ finishedSessions: count }))).toBe(false);
    }
    expect(SUPPORT_HINT_MIN_SESSIONS).toBe(5);
  });

  it('never appears while a workout is running', () => {
    expect(shouldShowSupportHint(state({ hasRunningWorkout: true }))).toBe(false);
  });

  it('never appears on the day a workout was finished', () => {
    // No asking right after finishing, hitting a record or reading a result.
    expect(shouldShowSupportHint(state({ lastFinishedDayKey: '2026-07-30' }))).toBe(
      false,
    );
  });

  it('respects the 30-day cooldown', () => {
    expect(SUPPORT_HINT_COOLDOWN_DAYS).toBe(30);
    expect(shouldShowSupportHint(state({ lastShownAt: daysAgo(1) }))).toBe(false);
    expect(shouldShowSupportHint(state({ lastShownAt: daysAgo(29) }))).toBe(false);
    expect(shouldShowSupportHint(state({ lastShownAt: daysAgo(31) }))).toBe(true);
  });

  it('never appears again after a permanent opt-out', () => {
    expect(
      shouldShowSupportHint(
        state({ dismissed: true, finishedSessions: 500, lastShownAt: daysAgo(400) }),
      ),
    ).toBe(false);
  });

  it('treats an unreadable timestamp as "just shown" instead of asking again', () => {
    expect(shouldShowSupportHint(state({ lastShownAt: 'not-a-date' }))).toBe(false);
  });

  it('works for a user with history but no workout today', () => {
    expect(
      shouldShowSupportHint(
        state({ finishedSessions: 40, lastFinishedDayKey: '2026-07-29' }),
      ),
    ).toBe(true);
  });
});
