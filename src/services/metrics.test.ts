import { describe, expect, it } from 'vitest';
import {
  addedWeightVolumeKg,
  aggregateVolume,
  computePersonalRecords,
  effectiveLoadKg,
  estimatedOneRepMax,
  findNewRecords,
  isWorkingSet,
  requiredFieldsFor,
  setVolumeKg,
} from '@/services/metrics';
import { makeContext, makeSessionExercise, makeSet } from '@/tests/factories';

describe('effectiveLoadKg / weight multiplier', () => {
  it('multiplies per-hand weights by the multiplier', () => {
    const context = makeSessionExercise({
      weightModeSnapshot: 'per_hand',
      weightMultiplierSnapshot: 2,
    });
    // Two dumbbells of 20 kg move 40 kg in total.
    expect(effectiveLoadKg({ weightKg: 20 }, context)).toBe(40);
  });

  it('treats a per-hand multiplier of 1 as a single-sided load', () => {
    const context = makeSessionExercise({
      weightModeSnapshot: 'per_hand',
      weightMultiplierSnapshot: 1,
    });
    expect(effectiveLoadKg({ weightKg: 20 }, context)).toBe(20);
  });

  it('uses total weights unchanged', () => {
    const context = makeSessionExercise({ weightModeSnapshot: 'total' });
    expect(effectiveLoadKg({ weightKg: 80 }, context)).toBe(80);
  });

  it('returns null when the load is not a full body load', () => {
    for (const mode of ['added_weight', 'assistance', 'none'] as const) {
      const context = makeSessionExercise({ weightModeSnapshot: mode });
      expect(effectiveLoadKg({ weightKg: 10 }, context)).toBeNull();
    }
  });

  it('returns null when no weight was recorded', () => {
    expect(effectiveLoadKg({ weightKg: undefined }, makeSessionExercise())).toBeNull();
  });
});

describe('setVolumeKg', () => {
  it('multiplies total load by repetitions', () => {
    const context = makeSessionExercise();
    expect(setVolumeKg(makeSet({ weightKg: 100, reps: 8 }), context)).toBe(800);
  });

  it('applies the multiplier for per-hand exercises', () => {
    const context = makeSessionExercise({
      weightModeSnapshot: 'per_hand',
      weightMultiplierSnapshot: 2,
    });
    expect(setVolumeKg(makeSet({ weightKg: 22.5, reps: 10 }), context)).toBe(450);
  });

  it('never invents a kilogram volume for bodyweight work', () => {
    const context = makeSessionExercise({
      trackingTypeSnapshot: 'bodyweight_reps',
      weightModeSnapshot: 'added_weight',
    });
    expect(setVolumeKg(makeSet({ weightKg: 10, reps: 8 }), context)).toBeNull();
  });

  it('never invents a volume for assisted, reps-only or timed work', () => {
    for (const trackingType of [
      'assisted_bodyweight_reps',
      'reps_only',
      'duration',
    ] as const) {
      const context = makeSessionExercise({ trackingTypeSnapshot: trackingType });
      expect(setVolumeKg(makeSet({ weightKg: 10, reps: 8 }), context)).toBeNull();
    }
  });

  it('returns null when repetitions are missing or zero', () => {
    const context = makeSessionExercise();
    expect(setVolumeKg(makeSet({ reps: undefined }), context)).toBeNull();
    expect(setVolumeKg(makeSet({ reps: 0 }), context)).toBeNull();
  });

  it('reports added weight of bodyweight sets separately', () => {
    const context = makeSessionExercise({
      trackingTypeSnapshot: 'bodyweight_reps',
      weightModeSnapshot: 'added_weight',
    });
    expect(addedWeightVolumeKg(makeSet({ weightKg: 10, reps: 6 }), context)).toBe(60);
    expect(addedWeightVolumeKg(makeSet({ weightKg: 0, reps: 6 }), context)).toBeNull();
  });
});

describe('estimatedOneRepMax (Epley)', () => {
  it('returns the load itself for a single repetition', () => {
    expect(
      estimatedOneRepMax(makeSet({ weightKg: 120, reps: 1 }), makeSessionExercise()),
    ).toBe(120);
  });

  it('follows the documented Epley formula', () => {
    // 100 kg × 10 reps → 100 × (1 + 10/30) = 133.33 kg
    const result = estimatedOneRepMax(
      makeSet({ weightKg: 100, reps: 10 }),
      makeSessionExercise(),
    );
    expect(result).toBeCloseTo(133.33, 2);
  });

  it('accounts for the per-hand multiplier', () => {
    const context = makeSessionExercise({
      weightModeSnapshot: 'per_hand',
      weightMultiplierSnapshot: 2,
    });
    // Total load 60 kg × (1 + 6/30) = 72
    expect(estimatedOneRepMax(makeSet({ weightKg: 30, reps: 6 }), context)).toBeCloseTo(
      72,
      5,
    );
  });

  it('refuses to estimate outside the reliable repetition range', () => {
    const context = makeSessionExercise();
    expect(estimatedOneRepMax(makeSet({ weightKg: 60, reps: 13 }), context)).toBeNull();
    expect(estimatedOneRepMax(makeSet({ weightKg: 60, reps: 0 }), context)).toBeNull();
  });

  it('refuses to estimate for exercises without external weight', () => {
    const context = makeSessionExercise({ trackingTypeSnapshot: 'bodyweight_reps' });
    expect(estimatedOneRepMax(makeSet({ weightKg: 10, reps: 8 }), context)).toBeNull();
  });
});

describe('aggregateVolume', () => {
  const sessionExercise = makeSessionExercise();

  it('excludes warm-up sets by default and includes them on request', () => {
    const entries = [
      { set: makeSet({ setType: 'warmup', weightKg: 40, reps: 10 }), sessionExercise },
      { set: makeSet({ setType: 'working', weightKg: 100, reps: 5 }), sessionExercise },
    ];

    expect(aggregateVolume(entries).volumeKg).toBe(500);
    expect(aggregateVolume(entries, { includeWarmup: true }).volumeKg).toBe(900);
  });

  it('ignores sets that were never completed', () => {
    const entries = [
      {
        set: makeSet({ completedAt: undefined, weightKg: 100, reps: 10 }),
        sessionExercise,
      },
    ];
    expect(aggregateVolume(entries).setCount).toBe(0);
  });

  it('counts sets without computable volume but keeps them out of the kilograms', () => {
    const bodyweight = makeSessionExercise({
      trackingTypeSnapshot: 'bodyweight_reps',
      weightModeSnapshot: 'added_weight',
    });
    const totals = aggregateVolume([
      { set: makeSet({ weightKg: 100, reps: 5 }), sessionExercise },
      { set: makeSet({ weightKg: 10, reps: 8 }), sessionExercise: bodyweight },
    ]);

    expect(totals.volumeKg).toBe(500);
    expect(totals.setsWithoutVolume).toBe(1);
    expect(totals.addedWeightVolumeKg).toBe(80);
    expect(totals.totalReps).toBe(13);
  });

  it('sums the duration of timed sets', () => {
    const timed = makeSessionExercise({ trackingTypeSnapshot: 'duration' });
    const totals = aggregateVolume([
      {
        set: makeSet({ weightKg: undefined, reps: undefined, durationSeconds: 45 }),
        sessionExercise: timed,
      },
      {
        set: makeSet({ weightKg: undefined, reps: undefined, durationSeconds: 60 }),
        sessionExercise: timed,
      },
    ]);
    expect(totals.totalDurationSeconds).toBe(105);
    expect(totals.volumeKg).toBe(0);
  });
});

describe('isWorkingSet and required fields', () => {
  it('counts drop and failure sets as working sets', () => {
    expect(isWorkingSet(makeSet({ setType: 'working' }))).toBe(true);
    expect(isWorkingSet(makeSet({ setType: 'drop' }))).toBe(true);
    expect(isWorkingSet(makeSet({ setType: 'failure' }))).toBe(true);
    expect(isWorkingSet(makeSet({ setType: 'warmup' }))).toBe(false);
  });

  it('requires the fields that match the tracking type', () => {
    expect(requiredFieldsFor('weight_reps')).toEqual({
      weight: true,
      reps: true,
      duration: false,
    });
    expect(requiredFieldsFor('duration')).toEqual({
      weight: false,
      reps: false,
      duration: true,
    });
    expect(requiredFieldsFor('reps_only')).toEqual({
      weight: false,
      reps: true,
      duration: false,
    });
  });
});

describe('personal records', () => {
  it('tracks the best load, estimate, repetitions and session volume per exercise', () => {
    const shared = { exerciseId: 'exercise-1', exerciseNameSnapshot: 'Bankdrücken' };
    const contexts = [
      makeContext({ weightKg: 100, reps: 5 }, shared),
      makeContext({ weightKg: 110, reps: 3 }, shared),
      makeContext({ weightKg: 90, reps: 12 }, shared),
    ];

    const records = computePersonalRecords(contexts);
    const record = records.get('exercise-1');

    expect(record?.bestLoadKg).toBe(110);
    expect(record?.bestLoadReps).toBe(3);
    expect(record?.bestReps).toBe(12);
    // 90 × (1 + 12/30) = 126 beats 110 × 1.1 = 121
    expect(record?.bestEstimatedOneRepMax).toBeCloseTo(126, 5);
  });

  it('ignores warm-up sets when determining records', () => {
    const shared = { exerciseId: 'exercise-1' };
    const records = computePersonalRecords([
      makeContext({ weightKg: 200, reps: 1, setType: 'warmup' }, shared),
      makeContext({ weightKg: 100, reps: 5 }, shared),
    ]);
    expect(records.get('exercise-1')?.bestLoadKg).toBe(100);
  });

  it('reports a new record only when it beats the earlier history', () => {
    const shared = { exerciseId: 'exercise-1', exerciseNameSnapshot: 'Bankdrücken' };
    const history = [makeContext({ weightKg: 100, reps: 5 }, shared)];

    const beaten = findNewRecords(
      [makeContext({ weightKg: 105, reps: 5 }, shared)],
      history,
    );
    expect(beaten.some((record) => record.kind === 'load' && record.value === 105)).toBe(
      true,
    );

    const notBeaten = findNewRecords(
      [makeContext({ weightKg: 95, reps: 5 }, shared)],
      history,
    );
    expect(notBeaten.some((record) => record.kind === 'load')).toBe(false);
  });

  it('marks a first-ever result as a record with no previous value', () => {
    const records = findNewRecords(
      [makeContext({ weightKg: 60, reps: 8 }, { exerciseId: 'exercise-9' })],
      [],
    );
    const load = records.find((record) => record.kind === 'load');
    expect(load?.previousValue).toBeNull();
  });
});
