import { describe, expect, it } from 'vitest';
import {
  buildRecordBaseline,
  compareSet,
  findPreviousSetForComparison,
  isNewRecord,
} from '@/services/comparison';
import { makeSessionExercise, makeSet } from '@/tests/factories';

const weighted = makeSessionExercise();
const perHand = makeSessionExercise({
  weightModeSnapshot: 'per_hand',
  weightMultiplierSnapshot: 2,
});
const bodyweight = makeSessionExercise({
  trackingTypeSnapshot: 'bodyweight_reps',
  weightModeSnapshot: 'added_weight',
});
const assisted = makeSessionExercise({
  trackingTypeSnapshot: 'assisted_bodyweight_reps',
  weightModeSnapshot: 'assistance',
});
const timed = makeSessionExercise({
  trackingTypeSnapshot: 'duration',
  weightModeSnapshot: 'none',
});
const repsOnly = makeSessionExercise({
  trackingTypeSnapshot: 'reps_only',
  weightModeSnapshot: 'none',
});

describe('findPreviousSetForComparison', () => {
  const previous = [
    makeSet({ position: 0, setType: 'warmup', weightKg: 40, reps: 10 }),
    makeSet({ position: 1, setType: 'working', weightKg: 80, reps: 8 }),
    makeSet({ position: 2, setType: 'working', weightKg: 80, reps: 7 }),
  ];

  it('matches the first working set with the first working set', () => {
    const match = findPreviousSetForComparison(previous, {
      setType: 'working',
      ordinalWithinType: 0,
    });
    expect(match?.set.reps).toBe(8);
    expect(match?.matchedBy).toBe('same-position');
  });

  it('matches the second working set with the second working set', () => {
    const match = findPreviousSetForComparison(previous, {
      setType: 'working',
      ordinalWithinType: 1,
    });
    expect(match?.set.reps).toBe(7);
  });

  it('does not compare a working set against a warm-up', () => {
    // The warm-up sits at position 0, but must never be the match for a
    // working set — that would flatter the comparison.
    const match = findPreviousSetForComparison(previous, {
      setType: 'working',
      ordinalWithinType: 0,
    });
    expect(match?.set.setType).toBe('working');
  });

  it('matches warm-ups only with warm-ups', () => {
    const match = findPreviousSetForComparison(previous, {
      setType: 'warmup',
      ordinalWithinType: 0,
    });
    expect(match?.set.setType).toBe('warmup');
  });

  it('falls back to the last working set when there is no matching position', () => {
    const match = findPreviousSetForComparison(previous, {
      setType: 'working',
      ordinalWithinType: 5,
    });
    expect(match?.set.reps).toBe(7);
    expect(match?.matchedBy).toBe('last-working-set');
  });

  it('gives warm-ups no fallback', () => {
    expect(
      findPreviousSetForComparison(previous, { setType: 'warmup', ordinalWithinType: 3 }),
    ).toBeNull();
  });

  it('falls back for a drop set rather than inventing a match', () => {
    const match = findPreviousSetForComparison(previous, {
      setType: 'drop',
      ordinalWithinType: 0,
    });
    expect(match?.matchedBy).toBe('last-working-set');
  });

  it('ignores sets that were never completed', () => {
    const withOpen = [makeSet({ position: 0, setType: 'working', completedAt: undefined })];
    expect(
      findPreviousSetForComparison(withOpen, { setType: 'working', ordinalWithinType: 0 }),
    ).toBeNull();
  });

  it('returns null when there is no history at all', () => {
    expect(
      findPreviousSetForComparison([], { setType: 'working', ordinalWithinType: 0 }),
    ).toBeNull();
  });
});

describe('compareSet — weighted exercises', () => {
  const match = {
    set: makeSet({ weightKg: 80, reps: 8 }),
    matchedBy: 'same-position' as const,
  };

  it('describes the previous set', () => {
    const result = compareSet({ weightKg: 80, reps: 8 }, match, weighted);
    expect(result?.previousSummary).toBe('80 kg × 8 Wdh.');
  });

  it('reports no delta when nothing changed', () => {
    expect(compareSet({ weightKg: 80, reps: 8 }, match, weighted)?.deltas).toEqual([]);
  });

  it('reports more weight as an improvement', () => {
    const result = compareSet({ weightKg: 82.5, reps: 8 }, match, weighted);
    expect(result?.deltas).toEqual([{ label: '+2,5 kg', direction: 'better' }]);
  });

  it('reports fewer repetitions as a regression', () => {
    const result = compareSet({ weightKg: 80, reps: 6 }, match, weighted);
    expect(result?.deltas).toEqual([{ label: '−2 Wdh.', direction: 'worse' }]);
  });

  it('reports both changes at once', () => {
    const result = compareSet({ weightKg: 85, reps: 6 }, match, weighted);
    expect(result?.deltas).toHaveLength(2);
    expect(result?.deltas[0].direction).toBe('better');
    expect(result?.deltas[1].direction).toBe('worse');
  });

  it('compares the total load for per-hand exercises', () => {
    const perHandMatch = {
      set: makeSet({ weightKg: 20, reps: 10 }),
      matchedBy: 'same-position' as const,
    };
    // 22.5 per hand × 2 = 45 kg against 20 × 2 = 40 kg.
    const result = compareSet({ weightKg: 22.5, reps: 10 }, perHandMatch, perHand);
    expect(result?.deltas[0].label).toBe('+5 kg');
  });

  it('stays silent until repetitions are entered', () => {
    expect(compareSet({ weightKg: 80 }, match, weighted)).toBeNull();
  });

  it('ignores floating point noise', () => {
    const noisy = { set: makeSet({ weightKg: 0.1 + 0.2, reps: 8 }), matchedBy: 'same-position' as const };
    expect(compareSet({ weightKg: 0.3, reps: 8 }, noisy, weighted)?.deltas).toEqual([]);
  });
});

describe('compareSet — other tracking types', () => {
  it('treats less assistance as progress', () => {
    const match = { set: makeSet({ weightKg: 20, reps: 8 }), matchedBy: 'same-position' as const };
    // 15 kg of assistance is easier support than 20 kg — that is an improvement.
    const result = compareSet({ weightKg: 15, reps: 8 }, match, assisted);
    expect(result?.deltas).toEqual([{ label: '−5 kg', direction: 'better' }]);
  });

  it('treats more assistance as a regression', () => {
    const match = { set: makeSet({ weightKg: 15, reps: 8 }), matchedBy: 'same-position' as const };
    expect(compareSet({ weightKg: 25, reps: 8 }, match, assisted)?.deltas[0].direction).toBe(
      'worse',
    );
  });

  it('treats more added weight as progress', () => {
    const match = { set: makeSet({ weightKg: 10, reps: 8 }), matchedBy: 'same-position' as const };
    expect(compareSet({ weightKg: 15, reps: 8 }, match, bodyweight)?.deltas[0].direction).toBe(
      'better',
    );
  });

  it('compares repetitions only for reps-only exercises', () => {
    const match = {
      set: makeSet({ weightKg: undefined, reps: 12 }),
      matchedBy: 'same-position' as const,
    };
    const result = compareSet({ reps: 14 }, match, repsOnly);
    expect(result?.deltas).toEqual([{ label: '+2 Wdh.', direction: 'better' }]);
    expect(result?.previousSummary).toBe('12 Wdh.');
  });

  it('compares duration for timed exercises', () => {
    const match = {
      set: makeSet({ weightKg: undefined, reps: undefined, durationSeconds: 45 }),
      matchedBy: 'same-position' as const,
    };
    const result = compareSet({ durationSeconds: 60 }, match, timed);
    expect(result?.deltas).toEqual([{ label: '+15 s', direction: 'better' }]);
    expect(result?.previousSummary).toBe('45 s');
  });

  it('stays silent for a timed set with no duration yet', () => {
    const match = {
      set: makeSet({ durationSeconds: 45 }),
      matchedBy: 'same-position' as const,
    };
    expect(compareSet({}, match, timed)).toBeNull();
  });
});

describe('record detection', () => {
  it('flags a heavier load as a record', () => {
    expect(isNewRecord({ weightKg: 85, reps: 5 }, weighted, { bestLoadKg: 80 })).toBe(true);
    expect(isNewRecord({ weightKg: 80, reps: 5 }, weighted, { bestLoadKg: 80 })).toBe(false);
  });

  it('makes no claim without a baseline', () => {
    // Never call the very first set a record — there is nothing to beat.
    expect(isNewRecord({ weightKg: 85, reps: 5 }, weighted, {})).toBe(false);
  });

  it('uses repetitions for bodyweight exercises', () => {
    expect(isNewRecord({ reps: 13 }, bodyweight, { bestReps: 12 })).toBe(true);
    expect(isNewRecord({ reps: 12 }, bodyweight, { bestReps: 12 })).toBe(false);
  });

  it('uses duration for timed exercises', () => {
    expect(isNewRecord({ durationSeconds: 70 }, timed, { bestDurationSeconds: 60 })).toBe(true);
  });

  it('accounts for the multiplier when judging a per-hand record', () => {
    // 21 per hand × 2 = 42 kg beats a 40 kg best.
    expect(isNewRecord({ weightKg: 21, reps: 8 }, perHand, { bestLoadKg: 40 })).toBe(true);
    expect(isNewRecord({ weightKg: 19, reps: 8 }, perHand, { bestLoadKg: 40 })).toBe(false);
  });
});

describe('buildRecordBaseline', () => {
  it('takes the best values from completed working sets', () => {
    const baseline = buildRecordBaseline(
      [
        makeSet({ weightKg: 80, reps: 8 }),
        makeSet({ weightKg: 90, reps: 3 }),
        makeSet({ weightKg: 70, reps: 12 }),
      ].map((set) => ({ set, context: weighted })),
    );

    expect(baseline.bestLoadKg).toBe(90);
    expect(baseline.bestReps).toBe(12);
  });

  it('ignores warm-ups and incomplete sets', () => {
    const baseline = buildRecordBaseline(
      [
        makeSet({ weightKg: 200, reps: 1, setType: 'warmup' }),
        makeSet({ weightKg: 150, reps: 1, completedAt: undefined }),
        makeSet({ weightKg: 80, reps: 8 }),
      ].map((set) => ({ set, context: weighted })),
    );

    expect(baseline.bestLoadKg).toBe(80);
  });

  it('is empty for an exercise with no history', () => {
    expect(buildRecordBaseline([])).toEqual({});
  });

  it('evaluates each set with its own convention and tracks the estimated 1RM', () => {
    // The same weight of 40 counts as 40 kg under "total" but 80 kg under
    // per-hand (multiplier 2) — the record must reflect each set's own context.
    const totalCtx = makeSessionExercise({
      weightModeSnapshot: 'total',
      weightMultiplierSnapshot: 1,
    });
    const perHandCtx = makeSessionExercise({
      weightModeSnapshot: 'per_hand',
      weightMultiplierSnapshot: 2,
    });
    const baseline = buildRecordBaseline([
      { set: makeSet({ weightKg: 40, reps: 5 }), context: totalCtx },
      { set: makeSet({ weightKg: 40, reps: 5 }), context: perHandCtx },
    ]);
    expect(baseline.bestLoadKg).toBe(80);
    expect(baseline.bestOneRepMaxKg).not.toBeNull();
  });
});
