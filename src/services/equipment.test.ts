import { describe, expect, it } from 'vitest';
import {
  effectiveSetExecution,
  equipmentLabel,
  executionKey,
  setExecutionKey,
  suggestedMultiplierForWeightMode,
  suggestedWeightModeForEquipment,
} from '@/services/equipment';
import { makeSessionExercise, makeSet } from '@/tests/factories';

describe('equipment labels', () => {
  it('labels a missing equipment as the neutral default', () => {
    expect(equipmentLabel(undefined)).toBe('Nicht festgelegt');
    expect(equipmentLabel('dumbbells')).toBe('Kurzhanteln');
  });
});

describe('suggestedWeightModeForEquipment', () => {
  it('suggests per-hand for dumbbells on a weighted exercise', () => {
    expect(suggestedWeightModeForEquipment('dumbbells', 'weight_reps')).toBe('per_hand');
    expect(suggestedMultiplierForWeightMode('per_hand')).toBe(2);
  });

  it('suggests total load for barbells and machines', () => {
    expect(suggestedWeightModeForEquipment('barbell', 'weight_reps')).toBe('total');
    expect(suggestedWeightModeForEquipment('machine', 'weight_reps')).toBe('total');
    expect(suggestedMultiplierForWeightMode('total')).toBe(1);
  });

  it('never suggests a mode the tracking type does not allow', () => {
    // Bodyweight reps only allow added_weight / none — dumbbells cannot force per_hand.
    expect(suggestedWeightModeForEquipment('dumbbells', 'bodyweight_reps')).not.toBe(
      'per_hand',
    );
    expect(suggestedWeightModeForEquipment('barbell', 'duration')).toBe('none');
  });
});

describe('effectiveSetExecution — field-by-field fallback', () => {
  it('prefers the per-set snapshot over the session-exercise snapshot', () => {
    const context = makeSessionExercise({
      weightModeSnapshot: 'total',
      weightMultiplierSnapshot: 1,
      equipmentSnapshot: 'barbell',
    });
    const set = makeSet({
      weightModeSnapshot: 'per_hand',
      weightMultiplierSnapshot: 2,
      equipmentSnapshot: 'dumbbells',
    });
    expect(effectiveSetExecution(set, context)).toEqual({
      trackingType: 'weight_reps',
      weightMode: 'per_hand',
      weightMultiplier: 2,
      equipment: 'dumbbells',
    });
  });

  it('falls back to the session-exercise snapshot for an old set without its own', () => {
    const context = makeSessionExercise({
      weightModeSnapshot: 'total',
      weightMultiplierSnapshot: 1,
      equipmentSnapshot: 'barbell',
    });
    const oldSet = makeSet(); // no execution snapshot fields
    expect(effectiveSetExecution(oldSet, context)).toEqual({
      trackingType: 'weight_reps',
      weightMode: 'total',
      weightMultiplier: 1,
      equipment: 'barbell',
    });
  });

  it('falls back to unspecified equipment when neither level has it', () => {
    const context = makeSessionExercise(); // no equipmentSnapshot
    expect(effectiveSetExecution(makeSet(), context).equipment).toBe('unspecified');
  });
});

describe('executionKey — the central like-for-like grouping', () => {
  const base = {
    trackingType: 'weight_reps',
    equipment: 'barbell',
    weightMode: 'total',
    weightMultiplier: 1,
  } as const;

  it('separates equipment, weight mode and tracking type', () => {
    expect(executionKey('ex1', base)).not.toBe(
      executionKey('ex1', { ...base, equipment: 'dumbbells' }),
    );
    expect(executionKey('ex1', base)).not.toBe(
      executionKey('ex1', { ...base, weightMode: 'per_hand' }),
    );
    expect(executionKey('ex1', base)).not.toBe(
      executionKey('ex1', { ...base, trackingType: 'reps_only' }),
    );
  });

  it('includes the multiplier only when it changes the load (per-hand work)', () => {
    // For a total-load set the multiplier is irrelevant, so it is normalised out.
    expect(executionKey('ex1', { ...base, weightMultiplier: 2 })).toBe(
      executionKey('ex1', { ...base, weightMultiplier: 1 }),
    );
    // For per-hand work a different multiplier is a different load, so a
    // different key.
    const perHand = { ...base, weightMode: 'per_hand' } as const;
    expect(executionKey('ex1', { ...perHand, weightMultiplier: 2 })).not.toBe(
      executionKey('ex1', { ...perHand, weightMultiplier: 1 }),
    );
  });

  it('a single, consistent execution collapses to one key across sets', () => {
    const context = makeSessionExercise({
      trackingTypeSnapshot: 'weight_reps',
      weightModeSnapshot: 'total',
      equipmentSnapshot: 'barbell',
    });
    const a = setExecutionKey('ex1', makeSet({ weightKg: 80 }), context);
    const b = setExecutionKey('ex1', makeSet({ weightKg: 100 }), context);
    expect(a).toBe(b);
  });

  it('a per-set execution snapshot overrides the session-exercise one', () => {
    const context = makeSessionExercise({
      trackingTypeSnapshot: 'weight_reps',
      weightModeSnapshot: 'total',
      equipmentSnapshot: 'barbell',
    });
    const switched = setExecutionKey(
      'ex1',
      makeSet({ equipmentSnapshot: 'dumbbells', weightModeSnapshot: 'per_hand' }),
      context,
    );
    const original = setExecutionKey('ex1', makeSet(), context);
    expect(switched).not.toBe(original);
  });
});
