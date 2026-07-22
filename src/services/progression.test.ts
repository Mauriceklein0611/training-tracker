import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WEIGHT_INCREMENT_KG,
  MIN_SETS_FOR_SUGGESTION,
  nextWeightDown,
  nextWeightUp,
  suggestProgression,
} from '@/services/progression';
import { makeSessionExercise, makeSet } from '@/tests/factories';

const weighted = makeSessionExercise();
const bodyweight = makeSessionExercise({
  trackingTypeSnapshot: 'bodyweight_reps',
  weightModeSnapshot: 'none',
});
const timed = makeSessionExercise({
  trackingTypeSnapshot: 'duration',
  weightModeSnapshot: 'none',
});

const RANGE = { targetRepMin: 8, targetRepMax: 12 };

/** Three working sets with the given repetition counts. */
function setsWithReps(repCounts: number[], weightKg = 80, rir?: number) {
  return repCounts.map((reps, index) =>
    makeSet({ position: index, setType: 'working', weightKg, reps, rir }),
  );
}

describe('next selectable weight', () => {
  it('adds the configured increment when no plate list exists', () => {
    expect(nextWeightUp(80, { weightIncrementKg: 2.5 })).toBe(82.5);
    expect(nextWeightUp(80, {})).toBe(80 + DEFAULT_WEIGHT_INCREMENT_KG);
  });

  it('picks the next entry that actually exists on the rack', () => {
    // A 42.5 kg suggestion would be useless when the rack jumps 40 → 45.
    expect(nextWeightUp(40, { availableWeightsKg: [30, 35, 40, 45, 50] })).toBe(45);
  });

  it('returns null at the top of the rack', () => {
    expect(nextWeightUp(50, { availableWeightsKg: [40, 45, 50] })).toBeNull();
  });

  it('steps down to a real weight as well', () => {
    expect(nextWeightDown(45, { availableWeightsKg: [30, 35, 40, 45] })).toBe(40);
    expect(nextWeightDown(80, { weightIncrementKg: 5 })).toBe(75);
  });

  it('never proposes zero or a negative weight', () => {
    expect(nextWeightDown(2, { weightIncrementKg: 2.5 })).toBeNull();
    expect(nextWeightDown(30, { availableWeightsKg: [30, 35] })).toBeNull();
  });

  it('ignores unusable entries in the weight list', () => {
    expect(nextWeightUp(40, { availableWeightsKg: [Number.NaN, 45] })).toBe(45);
  });
});

describe('insufficient data', () => {
  it('says so with fewer than two working sets', () => {
    const result = suggestProgression(setsWithReps([10]), weighted, RANGE);

    expect(result.action).toBe('insufficient_data');
    expect(result.reason).toContain(String(MIN_SETS_FOR_SUGGESTION));
  });

  it('says so without a target repetition range', () => {
    const result = suggestProgression(setsWithReps([10, 10]), weighted, {});

    expect(result.action).toBe('insufficient_data');
    expect(result.reason).toContain('Ziel-Wiederholungsbereich');
  });

  it('ignores warm-up sets when counting the basis', () => {
    const sets = [
      makeSet({ position: 0, setType: 'warmup', weightKg: 40, reps: 12 }),
      makeSet({ position: 1, setType: 'working', weightKg: 80, reps: 10 }),
    ];
    expect(suggestProgression(sets, weighted, RANGE).action).toBe('insufficient_data');
  });

  it('ignores drop and failure sets as a basis', () => {
    const sets = [
      makeSet({ position: 0, setType: 'working', weightKg: 80, reps: 12 }),
      makeSet({ position: 1, setType: 'drop', weightKg: 60, reps: 15 }),
      makeSet({ position: 2, setType: 'failure', weightKg: 80, reps: 4 }),
    ];
    // Only one plain working set remains.
    expect(suggestProgression(sets, weighted, RANGE).action).toBe('insufficient_data');
  });

  it('ignores sets without repetitions', () => {
    const sets = [
      makeSet({ position: 0, setType: 'working', weightKg: 80, reps: 10 }),
      makeSet({ position: 1, setType: 'working', weightKg: 80, reps: undefined }),
    ];
    expect(suggestProgression(sets, weighted, RANGE).action).toBe('insufficient_data');
  });

  it('never invents a suggestion from an empty history', () => {
    expect(suggestProgression([], weighted, RANGE).action).toBe('insufficient_data');
  });
});

describe('increase weight', () => {
  it('suggests more load when every set hit the top of the range', () => {
    const result = suggestProgression(setsWithReps([12, 12, 12]), weighted, RANGE);

    expect(result.action).toBe('increase_weight');
    expect(result.suggestedWeightKg).toBe(82.5);
    expect(result.reason).toContain('12 Wiederholungen');
  });

  it('respects the configured plate list', () => {
    const result = suggestProgression(setsWithReps([12, 12], 40), weighted, {
      ...RANGE,
      availableWeightsKg: [30, 35, 40, 45],
    });
    expect(result.suggestedWeightKg).toBe(45);
  });

  it('holds when nothing heavier is available', () => {
    const result = suggestProgression(setsWithReps([12, 12], 45), weighted, {
      ...RANGE,
      availableWeightsKg: [40, 45],
    });

    expect(result.action).toBe('hold');
    expect(result.reason).toContain('verfügbaren Gewichte');
  });

  it('does not increase when RIR says the sets were still hard', () => {
    // Target RIR 2, but the sets were taken to RIR 0 — not the moment to add load.
    const result = suggestProgression(setsWithReps([12, 12], 80, 0), weighted, {
      ...RANGE,
      targetRir: 2,
    });
    expect(result.action).not.toBe('increase_weight');
  });

  it('increases when RIR is at or above the target', () => {
    const result = suggestProgression(setsWithReps([12, 12], 80, 3), weighted, {
      ...RANGE,
      targetRir: 3,
    });
    expect(result.action).toBe('increase_weight');
  });

  it('applies the rule without RIR data instead of inventing values', () => {
    const result = suggestProgression(setsWithReps([12, 12]), weighted, {
      ...RANGE,
      targetRir: 2,
    });

    expect(result.action).toBe('increase_weight');
    expect(result.reason).toContain('RIR wurde nicht erfasst');
  });

  it('suggests more repetitions for bodyweight exercises', () => {
    const sets = setsWithReps([12, 12]).map((set) => ({ ...set, weightKg: undefined }));
    const result = suggestProgression(sets, bodyweight, RANGE);

    expect(result.action).toBe('add_reps');
    expect(result.suggestedReps).toBe(13);
    expect(result.suggestedWeightKg).toBeUndefined();
  });
});

describe('stay in range', () => {
  it('suggests adding a repetition when all sets are inside the range', () => {
    const result = suggestProgression(setsWithReps([9, 10, 9]), weighted, RANGE);

    expect(result.action).toBe('add_reps');
    expect(result.suggestedWeightKg).toBe(80);
    expect(result.suggestedReps).toBe(11);
  });

  it('does not suggest going past the top of the range', () => {
    const result = suggestProgression(setsWithReps([11, 12], 80), weighted, RANGE);
    // Mixed: one at the top, one below — hold, and never exceed the maximum.
    if (result.suggestedReps != null)
      expect(result.suggestedReps).toBeLessThanOrEqual(12);
  });
});

describe('reduce weight', () => {
  it('suggests less load when several sets fell short', () => {
    const result = suggestProgression(setsWithReps([6, 5, 9]), weighted, RANGE);

    expect(result.action).toBe('reduce_weight');
    expect(result.suggestedWeightKg).toBe(77.5);
    expect(result.reason).toContain('unter der unteren Grenze');
  });

  it('holds when only a single set fell short', () => {
    const result = suggestProgression(setsWithReps([7, 9, 10]), weighted, RANGE);
    expect(result.action).toBe('hold');
  });
});

describe('timed exercises', () => {
  it('suggests a longer hold', () => {
    const sets = [
      makeSet({
        position: 0,
        setType: 'working',
        weightKg: undefined,
        reps: undefined,
        durationSeconds: 45,
      }),
      makeSet({
        position: 1,
        setType: 'working',
        weightKg: undefined,
        reps: undefined,
        durationSeconds: 50,
      }),
    ];
    const result = suggestProgression(sets, timed, {});

    expect(result.action).toBe('add_reps');
    expect(result.reason).toContain('50 Sekunden');
  });

  it('says so when no times were recorded', () => {
    expect(suggestProgression([], timed, {}).action).toBe('insufficient_data');
  });
});

describe('every suggestion is explained', () => {
  it('always carries a reason and the number of sets considered', () => {
    const cases = [
      suggestProgression(setsWithReps([12, 12]), weighted, RANGE),
      suggestProgression(setsWithReps([9, 10]), weighted, RANGE),
      suggestProgression(setsWithReps([5, 6]), weighted, RANGE),
      suggestProgression(setsWithReps([10]), weighted, RANGE),
    ];

    for (const result of cases) {
      expect(result.reason.length).toBeGreaterThan(10);
      expect(result.headline.length).toBeGreaterThan(0);
      expect(typeof result.consideredSets).toBe('number');
    }
  });
});
