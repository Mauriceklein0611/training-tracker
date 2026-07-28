import { describe, expect, it } from 'vitest';
import type { ExerciseSeriesPoint } from '@/services/analytics';
import { analyzePlateau, plateauMessages } from '@/services/plateau';

function point(date: string, values: Partial<ExerciseSeriesPoint>): ExerciseSeriesPoint {
  return {
    date,
    startedAt: `${date}T10:00:00`,
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
    ...values,
  };
}

function oneRmSeries(values: number[]): ExerciseSeriesPoint[] {
  return values.map((value, index) =>
    point(`2026-07-${String(10 + index).padStart(2, '0')}`, {
      estimatedOneRepMax: value,
    }),
  );
}

describe('analyzePlateau — sufficiency', () => {
  it('makes no statement with fewer than four comparable sessions', () => {
    const result = analyzePlateau(oneRmSeries([100, 101, 102]), 'weight_reps');
    expect(result.status).toBe('insufficient');
    expect(plateauMessages(result)).toEqual([]);
  });

  it('makes no statement when the data is too inconsistent', () => {
    const result = analyzePlateau(oneRmSeries([100, 60, 130, 70, 120]), 'weight_reps');
    expect(result.status).toBe('inconsistent');
    expect(plateauMessages(result)).toEqual([]);
  });
});

describe('analyzePlateau — trend', () => {
  it('flags a flat estimated 1RM as a plateau', () => {
    const result = analyzePlateau(
      oneRmSeries([100, 100.5, 99.5, 100, 100.2]),
      'weight_reps',
    );
    expect(result.status).toBe('plateau');
    expect(result.metric).toBe('oneRepMax');
    expect(result.windowSize).toBe(5);
    expect(result.fromDate).toBe('2026-07-10');
    expect(result.toDate).toBe('2026-07-14');
  });

  it('does not flag a clearly progressing exercise', () => {
    const result = analyzePlateau(oneRmSeries([100, 103, 106, 109, 112]), 'weight_reps');
    expect(result.status).toBe('progress');
    expect(plateauMessages(result)).toEqual([]);
  });

  it('never calls an early peak with a clear current drop progress', () => {
    // A single early high followed by a drop is a regression, not progress.
    const result = analyzePlateau(oneRmSeries([100, 100, 110, 90]), 'weight_reps');
    expect(result.status).not.toBe('progress');
    expect(result.status).toBe('regress');
  });

  it('reports a gentle decline as a regression', () => {
    const result = analyzePlateau(oneRmSeries([100, 99, 97, 95, 93]), 'weight_reps');
    expect(result.status).toBe('regress');
    const messages = plateauMessages(result);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain('zurückgegangen');
  });

  it('only considers the most recent window', () => {
    // Long-ago progress, but the last six sessions are flat.
    const series = oneRmSeries([80, 85, 90, 100, 100.2, 99.8, 100.1, 100, 100.3]);
    const result = analyzePlateau(series, 'weight_reps');
    expect(result.status).toBe('plateau');
    expect(result.windowSize).toBe(6);
    expect(result.comparableSessions).toBe(9);
  });
});

describe('analyzePlateau — metric selection', () => {
  it('uses repetitions for bodyweight exercises without a 1RM', () => {
    const series = [12, 12, 11, 12].map((reps, index) =>
      point(`2026-07-1${index}`, { bestReps: reps }),
    );
    const result = analyzePlateau(series, 'bodyweight_reps');
    expect(result.metric).toBe('reps');
    expect(result.status).toBe('plateau');
  });

  it('uses duration for timed exercises', () => {
    const series = [60, 61, 59, 60].map((seconds, index) =>
      point(`2026-07-1${index}`, { maxDurationSeconds: seconds }),
    );
    const result = analyzePlateau(series, 'duration');
    expect(result.metric).toBe('duration');
    expect(result.status).toBe('plateau');
  });
});

describe('plateauMessages', () => {
  it('always ends with the honest caveat', () => {
    const result = analyzePlateau(oneRmSeries([100, 100, 100, 100]), 'weight_reps');
    const messages = plateauMessages(result);
    expect(messages[messages.length - 1]).toContain('nur ein Hinweis');
  });
});
