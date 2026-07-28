import { describe, expect, it } from 'vitest';
import {
  aggregateCardio,
  aggregatePace,
  computeCardioRecords,
  computePace,
  isCardioSet,
} from '@/services/cardioMetrics';
import { makeSessionExercise, makeSet } from '@/tests/factories';
import type { CardioModality } from '@/types';

const cardioContext = (modality: CardioModality) =>
  makeSessionExercise({
    trackingTypeSnapshot: 'cardio',
    weightModeSnapshot: 'none',
    cardioModalitySnapshot: modality,
  });

/** A completed cardio set (no weight/reps). */
const cardioSet = (fields: {
  durationSeconds?: number;
  distanceMeters?: number;
  averageHeartRateBpm?: number;
  caloriesKcal?: number;
}) => makeSet({ weightKg: undefined, reps: undefined, ...fields });

describe('computePace — modality conventions', () => {
  it('running: minutes per km', () => {
    // 6 km in 30 min → 5 min/km.
    const pace = computePace('running', 1800, 6000);
    expect(pace).toEqual({ kind: 'min_per_km', value: 5 });
  });

  it('rowing: seconds per 500 m', () => {
    // 2000 m in 480 s → 120 s / 500 m.
    const pace = computePace('rowing', 480, 2000);
    expect(pace).toEqual({ kind: 'per_500m', value: 120 });
  });

  it('swimming: seconds per 100 m', () => {
    // 400 m in 480 s → 120 s / 100 m.
    const pace = computePace('swimming', 480, 400);
    expect(pace).toEqual({ kind: 'per_100m', value: 120 });
  });

  it('cycling: km/h', () => {
    // 20 km in 40 min → 30 km/h.
    const pace = computePace('cycling', 2400, 20000);
    expect(pace).toEqual({ kind: 'km_per_h', value: 30 });
  });

  it('returns null without both duration and distance', () => {
    expect(computePace('running', 1800, undefined)).toBeNull();
    expect(computePace('running', undefined, 5000)).toBeNull();
    expect(computePace('running', 0, 5000)).toBeNull();
  });

  it('returns null for a modality without a distance-based pace', () => {
    expect(computePace('jump_rope', 600, 100)).toBeNull();
    expect(computePace('stair_climbing', 600, 100)).toBeNull();
  });
});

describe('aggregatePace — from totals, not a mean of paces', () => {
  it('uses total duration / total distance', () => {
    // Two runs: 1 km in 6 min (6 min/km) and 3 km in 12 min (4 min/km).
    // Mean of paces would be 5; the honest aggregate is 18 min / 4 km = 4.5.
    const pace = aggregatePace('running', 6 * 60 + 12 * 60, 1000 + 3000);
    expect(pace?.value).toBeCloseTo(4.5, 5);
  });

  it('never aggregates across modalities (caller passes one modality)', () => {
    // A swimming aggregate uses the swimming convention regardless of inputs.
    expect(aggregatePace('swimming', 480, 400)?.kind).toBe('per_100m');
  });
});

describe('computeCardioRecords', () => {
  it('tracks longest duration and greatest distance', () => {
    const entries = [
      {
        set: cardioSet({ durationSeconds: 1200, distanceMeters: 3000 }),
        context: cardioContext('running'),
      },
      {
        set: cardioSet({ durationSeconds: 1800, distanceMeters: 5000 }),
        context: cardioContext('running'),
      },
    ];
    const records = computeCardioRecords('running', entries);
    expect(records.longestDurationSeconds).toBe(1800);
    expect(records.greatestDistanceMeters).toBe(5000);
  });

  it('ignores a pace from below the minimum distance (operating error)', () => {
    const entries = [
      // 5 m in 1 s would be an absurd pace — below the 400 m minimum, ignored.
      {
        set: cardioSet({ durationSeconds: 1, distanceMeters: 5 }),
        context: cardioContext('running'),
      },
      {
        set: cardioSet({ durationSeconds: 1800, distanceMeters: 6000 }),
        context: cardioContext('running'),
      },
    ];
    const records = computeCardioRecords('running', entries);
    // Only the real run counts: 30 min for 6 km → 5 min/km.
    expect(records.bestPace).toEqual({ kind: 'min_per_km', value: 5 });
  });
});

describe('aggregateCardio', () => {
  it('duration-weights the heart rate from present values only', () => {
    const entries = [
      {
        set: cardioSet({ durationSeconds: 600, averageHeartRateBpm: 120 }),
        context: cardioContext('running'),
      },
      {
        set: cardioSet({ durationSeconds: 1800, averageHeartRateBpm: 160 }),
        context: cardioContext('running'),
      },
      // No HR recorded — must be ignored, not treated as 0.
      { set: cardioSet({ durationSeconds: 600 }), context: cardioContext('running') },
    ];
    const totals = aggregateCardio(entries);
    expect(totals.activities).toBe(3);
    expect(totals.totalDurationSeconds).toBe(3000);
    // (120*600 + 160*1800) / (600+1800) = 150.
    expect(totals.averageHeartRateBpm).toBeCloseTo(150, 5);
  });

  it('never invents calories that were not recorded', () => {
    const entries = [
      { set: cardioSet({ durationSeconds: 600 }), context: cardioContext('cycling') },
    ];
    const totals = aggregateCardio(entries);
    expect(totals.totalCaloriesKcal).toBe(0);
    expect(totals.averageHeartRateBpm).toBeNull();
  });
});

describe('isCardioSet', () => {
  it('is true for a cardio-execution set and false for strength', () => {
    expect(
      isCardioSet(cardioSet({ durationSeconds: 600 }), cardioContext('running')),
    ).toBe(true);
    expect(isCardioSet(makeSet(), makeSessionExercise())).toBe(false);
  });
});
