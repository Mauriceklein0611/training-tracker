import { describe, expect, it } from 'vitest';
import {
  comparePlans,
  filterDatasetByDeload,
  filterDatasetByPlan,
  filterSessionsByDeload,
  isDeloadSession,
  restrictDatasetToSessions,
} from '@/services/analysisFilters';
import type { AnalyticsDataset } from '@/services/analytics';
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
