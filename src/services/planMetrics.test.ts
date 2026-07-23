import { describe, expect, it } from 'vitest';
import { computePlanOverview } from '@/services/planMetrics';
import type { WorkoutSession } from '@/types';

function session(startedAt: string, finishedAt?: string): WorkoutSession {
  return {
    id: startedAt,
    name: 'Training',
    status: 'completed',
    startedAt,
    finishedAt,
    notes: '',
    createdAt: startedAt,
    updatedAt: startedAt,
  };
}

describe('computePlanOverview', () => {
  it('returns an empty overview for no sessions', () => {
    const overview = computePlanOverview({ sessions: [], weeklyTarget: 3 });
    expect(overview.sessionCount).toBe(0);
    expect(overview.sessionsThisWeek).toBe(0);
    expect(overview.avgSessionsPerWeek).toBeUndefined();
    expect(overview.weeklyTarget).toBe(3);
  });

  it('counts sessions and the span, first and last', () => {
    const overview = computePlanOverview({
      sessions: [
        session('2026-07-01T10:00:00', '2026-07-01T11:00:00'),
        session('2026-07-08T10:00:00', '2026-07-08T11:00:00'),
        session('2026-07-15T10:00:00', '2026-07-15T11:00:00'),
      ],
      today: new Date('2026-07-16T10:00:00'),
    });
    expect(overview.sessionCount).toBe(3);
    expect(overview.firstSessionAt).toBe('2026-07-01T11:00:00');
    expect(overview.lastSessionAt).toBe('2026-07-15T11:00:00');
    expect(overview.spanDays).toBe(15);
    // 3 sessions over ~15 days ≈ 2.1 weeks → ~1.4 / week.
    expect(overview.avgSessionsPerWeek).toBeCloseTo(1.4, 1);
  });

  it('counts only sessions in the current Monday-based week', () => {
    const overview = computePlanOverview({
      sessions: [
        session('2026-07-13T10:00:00'), // Monday
        session('2026-07-15T10:00:00'), // Wednesday
        session('2026-07-19T10:00:00'), // Sunday
        session('2026-07-20T10:00:00'), // next Monday — excluded
      ],
      today: new Date('2026-07-16T09:00:00'), // Thursday of that week
    });
    expect(overview.sessionsThisWeek).toBe(3);
  });
});
