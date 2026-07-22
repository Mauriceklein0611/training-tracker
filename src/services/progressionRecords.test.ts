import { describe, expect, it } from 'vitest';
import { buildRecordBaseline, isNewRecord } from '@/services/comparison';
import { suggestProgression } from '@/services/progression';
import { makeSessionExercise, makeSet } from '@/tests/factories';

const weightContext = makeSessionExercise({ trackingTypeSnapshot: 'weight_reps', weightModeSnapshot: 'total' });

describe('records use the full history baseline', () => {
  it('an older record still counts, even when the last workout was weaker', () => {
    // History: an old heavy session (100 kg) and a lighter recent one (90 kg).
    const history = [
      makeSet({ weightKg: 100, reps: 5, completedAt: '2026-05-01T10:00:00' }),
      makeSet({ weightKg: 90, reps: 8, completedAt: '2026-06-01T10:00:00' }),
    ].map((set) => ({ set, context: weightContext }));
    const baseline = buildRecordBaseline(history);
    expect(baseline.bestLoadKg).toBe(100);

    // 95 kg beats the last workout (90) but not the older record (100).
    expect(isNewRecord({ weightKg: 95, reps: 5 }, weightContext, baseline)).toBe(false);
    // 105 kg beats everything → a real record.
    expect(isNewRecord({ weightKg: 105, reps: 3 }, weightContext, baseline)).toBe(true);
  });

  it('ignores warm-ups when building the baseline', () => {
    const history = [
      makeSet({ weightKg: 120, reps: 5, setType: 'warmup', completedAt: '2026-05-01T10:00:00' }),
      makeSet({ weightKg: 80, reps: 8, completedAt: '2026-05-01T10:05:00' }),
    ].map((set) => ({ set, context: weightContext }));
    expect(buildRecordBaseline(history).bestLoadKg).toBe(80);
  });
});

describe('progression is based on the current sets', () => {
  const config = { targetRepMin: 8, targetRepMax: 12 };

  it('does not recommend more weight when the current sets fell below the range', () => {
    const currentSets = [
      makeSet({ weightKg: 100, reps: 5, completedAt: '2026-07-01T10:00:00' }),
      makeSet({ weightKg: 100, reps: 4, completedAt: '2026-07-01T10:03:00' }),
    ];
    const suggestion = suggestProgression(currentSets, weightContext, config);
    expect(suggestion.action).not.toBe('increase_weight');
    expect(suggestion.action).toBe('reduce_weight');
  });

  it('adds a repetition when the current sets are inside the target range', () => {
    const currentSets = [
      makeSet({ weightKg: 100, reps: 10, completedAt: '2026-07-01T10:00:00' }),
      makeSet({ weightKg: 100, reps: 10, completedAt: '2026-07-01T10:03:00' }),
    ];
    const suggestion = suggestProgression(currentSets, weightContext, config);
    expect(suggestion.action).toBe('add_reps');
  });

  it('recommends more weight when every current set maxed out the range', () => {
    const currentSets = [
      makeSet({ weightKg: 100, reps: 12, completedAt: '2026-07-01T10:00:00' }),
      makeSet({ weightKg: 100, reps: 12, completedAt: '2026-07-01T10:03:00' }),
    ];
    const suggestion = suggestProgression(currentSets, weightContext, {
      ...config,
      weightIncrementKg: 2.5,
    });
    expect(suggestion.action).toBe('increase_weight');
    expect(suggestion.suggestedWeightKg).toBe(102.5);
  });
});
