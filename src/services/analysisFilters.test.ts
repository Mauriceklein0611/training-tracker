import { describe, expect, it } from 'vitest';
import {
  comparePlans,
  compareWorkoutUnits,
  filterDatasetByDeload,
  filterDatasetByPlan,
  filterDatasetByWorkoutUnit,
  filterSessionsByDeload,
  isDeloadSession,
  planUsagePeriodsOverlap,
  planUsageSpan,
  restrictDatasetToSessions,
  sessionWorkoutUnitId,
} from '@/services/analysisFilters';
import type { AnalyticsDataset } from '@/services/analytics';
import type { PlanUsagePeriod } from '@/types';
import {
  makeExercise,
  makeSession,
  makeSessionExercise,
  makeSet,
} from '@/tests/factories';
import type { DateRange } from '@/utils/date';

/** A dataset: two plans, one deload session, one normal, plus a free session. */
function dataset(): AnalyticsDataset {
  const exercise = makeExercise({ id: 'ex' });
  const sessions = [
    makeSession({ id: 's1', planId: 'A', startedAt: '2026-07-01T10:00:00.000Z' }),
    makeSession({
      id: 's2',
      planId: 'A',
      deloadIntensity: 'medium',
      startedAt: '2026-07-08T10:00:00.000Z',
    }),
    makeSession({ id: 's3', planId: 'B', startedAt: '2026-07-03T10:00:00.000Z' }),
  ];
  const sessionExercises = sessions.map((s) =>
    makeSessionExercise({ id: `se-${s.id}`, sessionId: s.id, exerciseId: 'ex' }),
  );
  const sets = sessionExercises.map((se) =>
    makeSet({ id: `set-${se.id}`, sessionExerciseId: se.id }),
  );
  return { sessions, sessionExercises, sets, exercises: [exercise] };
}

describe('deload filtering', () => {
  it('detects deload sessions', () => {
    expect(isDeloadSession(makeSession({ deloadIntensity: 'light' }))).toBe(true);
    expect(isDeloadSession(makeSession())).toBe(false);
  });

  it('include/exclude/only select the right sessions', () => {
    const { sessions } = dataset();
    expect(filterSessionsByDeload(sessions, 'include')).toHaveLength(3);
    expect(filterSessionsByDeload(sessions, 'exclude').map((s) => s.id)).toEqual([
      's1',
      's3',
    ]);
    expect(filterSessionsByDeload(sessions, 'only').map((s) => s.id)).toEqual(['s2']);
  });

  it('prunes dependent rows when filtering the dataset', () => {
    const filtered = filterDatasetByDeload(dataset(), 'exclude');
    expect(filtered.sessions.map((s) => s.id).sort()).toEqual(['s1', 's3']);
    // The deload session's exercise and set are gone.
    expect(filtered.sessionExercises.some((e) => e.sessionId === 's2')).toBe(false);
    expect(filtered.sets.some((set) => set.sessionExerciseId === 'se-s2')).toBe(false);
  });
});

describe('plan scoping', () => {
  it('keeps only the plan_s sessions and their rows', () => {
    const filtered = filterDatasetByPlan(dataset(), 'A');
    expect(filtered.sessions.map((s) => s.id).sort()).toEqual(['s1', 's2']);
    expect(filtered.sets.map((set) => set.sessionExerciseId).sort()).toEqual([
      'se-s1',
      'se-s2',
    ]);
    // Exercises (reference data) are retained.
    expect(filtered.exercises).toHaveLength(1);
  });

  it('restrictDatasetToSessions is consistent for an empty selection', () => {
    const filtered = restrictDatasetToSessions(dataset(), new Set());
    expect(filtered.sessions).toHaveLength(0);
    expect(filtered.sessionExercises).toHaveLength(0);
    expect(filtered.sets).toHaveLength(0);
  });
});

describe('comparePlans', () => {
  const range: DateRange = {
    from: new Date('2026-07-01T00:00:00'),
    to: new Date('2026-07-31T23:59:59'),
  };

  it('scopes each side to its plan and reuses the engine', () => {
    const result = comparePlans(
      dataset(),
      [],
      { planId: 'A', label: 'Plan A', range },
      { planId: 'B', label: 'Plan B', range },
      'include',
      new Date('2026-08-01T00:00:00'),
    );
    expect(result.a.metrics.sessions).toBe(2);
    expect(result.b.metrics.sessions).toBe(1);
    expect(result.a.label).toBe('Plan A');
  });

  it('excludes deload from a plan side when asked', () => {
    const result = comparePlans(
      dataset(),
      [],
      { planId: 'A', label: 'Plan A', range },
      { planId: 'B', label: 'Plan B', range },
      'exclude',
      new Date('2026-08-01T00:00:00'),
    );
    // Plan A had 2 sessions, one of them a deload → 1 remains.
    expect(result.a.metrics.sessions).toBe(1);
  });
});

describe('workout unit scoping', () => {
  // U1 trained directly and via a plan day (day-1); U2 directly; one free session.
  const dayToUnitId = new Map([['day-1', 'U1']]);
  function unitDataset(): AnalyticsDataset {
    const exercise = makeExercise({ id: 'ex' });
    const sessions = [
      makeSession({ id: 'd1', workoutUnitTemplateId: 'U1' }),
      makeSession({ id: 'd2', templateId: 'day-1' }),
      makeSession({ id: 'd3', workoutUnitTemplateId: 'U2' }),
      makeSession({ id: 'd4' }),
    ];
    const sessionExercises = sessions.map((s) =>
      makeSessionExercise({ id: `se-${s.id}`, sessionId: s.id, exerciseId: 'ex' }),
    );
    const sets = sessionExercises.map((se) =>
      makeSet({ id: `set-${se.id}`, sessionExerciseId: se.id }),
    );
    return { sessions, sessionExercises, sets, exercises: [exercise] };
  }

  it('attributes a session to its direct or plan-day source unit', () => {
    const { sessions } = unitDataset();
    const [d1, d2, d3, d4] = sessions;
    expect(sessionWorkoutUnitId(d1, dayToUnitId)).toBe('U1'); // direct
    expect(sessionWorkoutUnitId(d2, dayToUnitId)).toBe('U1'); // via plan day
    expect(sessionWorkoutUnitId(d3, dayToUnitId)).toBe('U2');
    expect(sessionWorkoutUnitId(d4, dayToUnitId)).toBeUndefined();
  });

  it('scopes the dataset to one unit across both attribution paths', () => {
    const filtered = filterDatasetByWorkoutUnit(unitDataset(), 'U1', dayToUnitId);
    expect(filtered.sessions.map((s) => s.id).sort()).toEqual(['d1', 'd2']);
  });

  it('compares two units by reusing the metrics engine', () => {
    const range: DateRange = {
      from: new Date('2026-01-01T00:00:00'),
      to: new Date('2026-12-31T23:59:59'),
    };
    const result = compareWorkoutUnits(
      unitDataset(),
      [],
      dayToUnitId,
      { unitId: 'U1', label: 'Push', range },
      { unitId: 'U2', label: 'Pull', range },
    );
    expect(result.a.metrics.sessions).toBe(2);
    expect(result.b.metrics.sessions).toBe(1);
    expect(result.a.label).toBe('Push');
  });
});

describe('plan usage spans and overlap', () => {
  const now = new Date('2026-08-01T12:00:00');
  function period(planId: string, startDate: string, endDate?: string): PlanUsagePeriod {
    return {
      id: `${planId}-${startDate}`,
      planId,
      planNameSnapshot: planId,
      startDate,
      endDate,
      createdAt: '',
      updatedAt: '',
    };
  }

  it('spans a plan from its earliest start to its latest end (open = today)', () => {
    const periods = [
      period('A', '2026-06-01', '2026-06-20'),
      period('A', '2026-07-01'), // open → runs to today
    ];
    expect(planUsageSpan(periods, 'A', now)).toEqual({
      from: '2026-06-01',
      to: '2026-08-01',
    });
    expect(planUsageSpan(periods, 'B', now)).toBeNull();
  });

  it('detects overlapping usage periods between two plans', () => {
    const overlapping = [
      period('A', '2026-06-01', '2026-06-30'),
      period('B', '2026-06-20', '2026-07-10'),
    ];
    expect(planUsagePeriodsOverlap(overlapping, 'A', 'B', now)).toBe(true);

    const disjoint = [
      period('A', '2026-06-01', '2026-06-10'),
      period('B', '2026-06-20', '2026-06-30'),
    ];
    expect(planUsagePeriodsOverlap(disjoint, 'A', 'B', now)).toBe(false);
  });
});
