import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage } from '@/i18n';
import {
  SET_TYPES,
  TRACKING_TYPES,
  WEIGHT_MODES,
  setTypeLabel,
  setTypeShort,
  trackingTypeHelp,
  trackingTypeLabel,
  weightModeHelp,
  weightModeLabel,
} from '@/utils/format';

afterEach(() => setLanguage('de'));

describe('domain labels', () => {
  it('translates tracking types, weight modes and set types', () => {
    setLanguage('de');
    expect(trackingTypeLabel('weight_reps')).toBe('Gewicht + Wiederholungen');
    expect(weightModeLabel('per_hand')).toBe('Je Hand');
    expect(setTypeLabel('warmup')).toBe('Aufwärmsatz');

    setLanguage('en');
    expect(trackingTypeLabel('weight_reps')).toBe('Weight + reps');
    expect(weightModeLabel('per_hand')).toBe('Per hand');
    expect(setTypeLabel('warmup')).toBe('Warm-up set');
  });

  it('has a non-empty label, help text and badge for every enum value', () => {
    for (const language of ['de', 'en'] as const) {
      setLanguage(language);
      for (const type of TRACKING_TYPES) {
        expect(trackingTypeLabel(type).length, `${language}/${type}`).toBeGreaterThan(0);
        expect(trackingTypeHelp(type)).not.toBe(`domain:trackingTypeHelp.${type}`);
      }
      for (const mode of WEIGHT_MODES) {
        expect(weightModeLabel(mode).length, `${language}/${mode}`).toBeGreaterThan(0);
        expect(weightModeHelp(mode)).not.toBe(`domain:weightModeHelp.${mode}`);
      }
      for (const type of SET_TYPES) {
        expect(setTypeLabel(type).length, `${language}/${type}`).toBeGreaterThan(0);
        expect(setTypeShort(type)).toHaveLength(1);
      }
    }
  });

  it('keeps the enum order independent of the translation files', () => {
    // Pickers render these in a fixed, meaningful order — never in whatever
    // order a translation file happens to list its keys.
    expect([...TRACKING_TYPES]).toEqual([
      'weight_reps',
      'bodyweight_reps',
      'assisted_bodyweight_reps',
      'reps_only',
      'duration',
      'cardio',
    ]);
    expect([...SET_TYPES]).toEqual(['warmup', 'working', 'drop', 'failure']);
    expect([...WEIGHT_MODES]).toEqual([
      'per_hand',
      'total',
      'added_weight',
      'assistance',
      'none',
    ]);
  });

  it('uses distinct one-letter set badges per language', () => {
    for (const language of ['de', 'en'] as const) {
      setLanguage(language);
      const badges = SET_TYPES.map(setTypeShort);
      expect(new Set(badges).size, language).toBe(badges.length);
    }
  });
});
