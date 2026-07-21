import { describe, expect, it } from 'vitest';
import {
  computeRestProgress,
  computeRestStatistics,
  restDeviationSeconds,
  restTargetMet,
} from '@/services/rest';
import { makeSet } from '@/tests/factories';

describe('computeRestProgress', () => {
  const start = new Date('2026-07-01T10:00:00.000Z');

  it('derives the remaining time from the absolute start timestamp', () => {
    const progress = computeRestProgress(
      { restStartedAt: start.toISOString(), restTargetSeconds: 120 },
      new Date('2026-07-01T10:00:45.000Z'),
    );

    expect(progress.running).toBe(true);
    expect(progress.elapsedSeconds).toBe(45);
    expect(progress.remainingSeconds).toBe(75);
    expect(progress.targetReached).toBe(false);
  });

  it('stays correct after a long interruption, e.g. a locked screen', () => {
    // The app was in the background for ten minutes; nothing was counted in the
    // meantime, yet the elapsed time must still be exact.
    const progress = computeRestProgress(
      { restStartedAt: start.toISOString(), restTargetSeconds: 120 },
      new Date('2026-07-01T10:10:00.000Z'),
    );

    expect(progress.elapsedSeconds).toBe(600);
    expect(progress.remainingSeconds).toBe(0);
    expect(progress.overtimeSeconds).toBe(480);
    expect(progress.targetReached).toBe(true);
  });

  it('reports exactly reaching the target as reached', () => {
    const progress = computeRestProgress(
      { restStartedAt: start.toISOString(), restTargetSeconds: 90 },
      new Date('2026-07-01T10:01:30.000Z'),
    );
    expect(progress.targetReached).toBe(true);
    expect(progress.overtimeSeconds).toBe(0);
  });

  it('is idle once the rest has been ended', () => {
    const progress = computeRestProgress(
      {
        restStartedAt: start.toISOString(),
        restEndedAt: '2026-07-01T10:02:00.000Z',
        restTargetSeconds: 120,
      },
      new Date('2026-07-01T10:05:00.000Z'),
    );
    expect(progress.running).toBe(false);
    expect(progress.elapsedSeconds).toBe(0);
  });

  it('is idle when no rest has been started', () => {
    expect(computeRestProgress(undefined).running).toBe(false);
    expect(computeRestProgress({ restTargetSeconds: 60 }).remainingSeconds).toBe(60);
  });

  it('never reports a negative elapsed time for a clock skewed into the future', () => {
    const progress = computeRestProgress(
      { restStartedAt: '2026-07-01T10:05:00.000Z', restTargetSeconds: 60 },
      new Date('2026-07-01T10:00:00.000Z'),
    );
    expect(progress.elapsedSeconds).toBe(0);
  });

  it('ignores an unparsable timestamp instead of throwing', () => {
    const progress = computeRestProgress({ restStartedAt: 'kaputt', restTargetSeconds: 60 });
    expect(progress.running).toBe(false);
  });
});

describe('rest evaluation', () => {
  it('computes the deviation from the target rest', () => {
    expect(restDeviationSeconds(makeSet({ restTargetSeconds: 120, restActualSeconds: 135 }))).toBe(15);
    expect(restDeviationSeconds(makeSet({ restTargetSeconds: 120, restActualSeconds: 90 }))).toBe(-30);
  });

  it('has no opinion when there is no target or no measurement', () => {
    expect(restDeviationSeconds(makeSet({ restTargetSeconds: 0, restActualSeconds: 60 }))).toBeNull();
    expect(restDeviationSeconds(makeSet({ restTargetSeconds: 120 }))).toBeNull();
  });

  it('reports whether the planned rest was reached', () => {
    expect(restTargetMet(makeSet({ restTargetSeconds: 120, restActualSeconds: 120 }))).toBe(true);
    expect(restTargetMet(makeSet({ restTargetSeconds: 120, restActualSeconds: 119 }))).toBe(false);
  });

  it('aggregates averages and the share of rests that reached the target', () => {
    const stats = computeRestStatistics([
      makeSet({ restTargetSeconds: 120, restActualSeconds: 130 }),
      makeSet({ restTargetSeconds: 120, restActualSeconds: 110 }),
      makeSet({ restTargetSeconds: 60, restActualSeconds: 90 }),
      // Ignored: no measurement.
      makeSet({ restTargetSeconds: 60 }),
    ]);

    expect(stats.evaluatedSets).toBe(3);
    expect(stats.averageActualSeconds).toBeCloseTo(110, 5);
    expect(stats.averageTargetSeconds).toBeCloseTo(100, 5);
    expect(stats.averageDeviationSeconds).toBeCloseTo(10, 5);
    expect(stats.targetMetRatio).toBeCloseTo(2 / 3, 5);
  });

  it('returns empty statistics when nothing can be evaluated', () => {
    expect(computeRestStatistics([]).evaluatedSets).toBe(0);
    expect(computeRestStatistics([]).averageDeviationSeconds).toBeNull();
  });
});
