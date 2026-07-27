import { describe, expect, it } from 'vitest';
import {
  effectiveSetExecution,
  equipmentLabel,
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
