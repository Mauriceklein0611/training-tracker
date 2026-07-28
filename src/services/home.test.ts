import { describe, expect, it } from 'vitest';
import { planCycleWeek } from '@/services/home';

describe('planCycleWeek', () => {
  const today = new Date('2026-07-28T12:00:00');

  it('returns the 1-based week within the planned cycle', () => {
    // Started 2026-07-13 (15 days ago) → day 15 → week 3.
    expect(planCycleWeek('2026-07-13', 8, today)).toEqual({ current: 3, total: 8 });
  });

  it('clamps an overrun to the last planned week', () => {
    // Started 12 weeks ago but only 8 were planned.
    expect(planCycleWeek('2026-05-05', 8, today)).toEqual({ current: 8, total: 8 });
  });

  it('is null without a start date or planned duration', () => {
    expect(planCycleWeek(undefined, 8, today)).toBeNull();
    expect(planCycleWeek('2026-07-13', undefined, today)).toBeNull();
    expect(planCycleWeek('2026-07-13', 0, today)).toBeNull();
  });

  it('is null when the plan starts in the future', () => {
    expect(planCycleWeek('2026-08-10', 8, today)).toBeNull();
  });
});
