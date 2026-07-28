import { describe, expect, it } from 'vitest';
import type { ExerciseSeriesPoint } from '@/services/analytics';
import { summarizeExerciseHistory } from '@/services/exerciseHistory';

function point(overrides: Partial<ExerciseSeriesPoint>): ExerciseSeriesPoint {
  return {
    date: '2026-07-01',
    startedAt: '2026-07-01T10:00:00.000Z',
    volumeKg: null,
    topSetLoadKg: null,
    topSetReps: null,
    estimatedOneRepMax: null,
    totalReps: 0,
    bestReps: null,
    maxDurationSeconds: null,
    workingSets: 3,
    cardioDurationSeconds: null,
    cardioDistanceMeters: null,
    cardioPace: null,
    ...overrides,
  };
}

describe('summarizeExerciseHistory', () => {
  it('reports the best e1RM and heaviest top set with its reps', () => {
    const series = [
      point({
        date: '2026-07-01',
        topSetLoadKg: 50,
        topSetReps: 10,
        estimatedOneRepMax: 66,
      }),
      point({
        date: '2026-07-08',
        topSetLoadKg: 60,
        topSetReps: 8,
        estimatedOneRepMax: 76,
      }),
      point({
        date: '2026-07-15',
        topSetLoadKg: 55,
        topSetReps: 5,
        estimatedOneRepMax: 64,
      }),
    ];
    const summary = summarizeExerciseHistory(series);
    expect(summary.sessionCount).toBe(3);
    expect(summary.bestE1rm).toBe(76);
    expect(summary.bestLoadKg).toBe(60);
    expect(summary.bestLoadReps).toBe(8);
    // last is the most recent session, recent is newest-first.
    expect(summary.last?.date).toBe('2026-07-15');
    expect(summary.recent.map((p) => p.date)).toEqual([
      '2026-07-15',
      '2026-07-08',
      '2026-07-01',
    ]);
  });

  it('keeps nulls when nothing is recordable and caps recent at five', () => {
    const series = Array.from({ length: 7 }, (_, i) =>
      point({ date: `2026-07-0${i + 1}`, startedAt: `2026-07-0${i + 1}T10:00:00.000Z` }),
    );
    const summary = summarizeExerciseHistory(series);
    expect(summary.bestE1rm).toBeNull();
    expect(summary.bestLoadKg).toBeNull();
    expect(summary.recent).toHaveLength(5);
  });

  it('is all-null for an exercise with no history', () => {
    const summary = summarizeExerciseHistory([]);
    expect(summary).toEqual({
      sessionCount: 0,
      bestE1rm: null,
      bestLoadKg: null,
      bestLoadReps: null,
      last: null,
      recent: [],
    });
  });
});
