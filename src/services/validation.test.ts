import { describe, expect, it } from 'vitest';
import {
  hasErrors,
  parseNumberInput,
  validateExerciseForm,
  validateSetInput,
} from '@/services/validation';

describe('parseNumberInput', () => {
  it('accepts a comma as decimal separator, as typed on a German keyboard', () => {
    expect(parseNumberInput('22,5')).toBe(22.5);
    expect(parseNumberInput('22.5')).toBe(22.5);
  });

  it('treats empty input as "not entered"', () => {
    expect(parseNumberInput('')).toBeNull();
    expect(parseNumberInput('   ')).toBeNull();
  });

  it('reports nonsense as NaN rather than a wrong number', () => {
    expect(parseNumberInput('abc')).toBeNaN();
  });
});

describe('validateSetInput', () => {
  it('accepts a complete weighted set', () => {
    const errors = validateSetInput({ weightKg: 80, reps: 8 }, 'weight_reps', 'total');
    expect(hasErrors(errors)).toBe(false);
  });

  it('rejects a negative weight', () => {
    const errors = validateSetInput({ weightKg: -1, reps: 8 }, 'weight_reps', 'total');
    expect(errors.weightKg).toContain('negativ');
  });

  it('requires repetitions to be whole numbers', () => {
    const errors = validateSetInput({ weightKg: 80, reps: 8.5 }, 'weight_reps', 'total');
    expect(errors.reps).toContain('ganzzahlig');
  });

  it('rejects negative repetitions and durations', () => {
    expect(validateSetInput({ reps: -2 }, 'reps_only', 'none').reps).toContain('negativ');
    expect(
      validateSetInput({ durationSeconds: -5 }, 'duration', 'none').durationSeconds,
    ).toContain('negativ');
  });

  it('keeps RIR between 0 and 10', () => {
    expect(
      validateSetInput({ reps: 8, rir: 0 }, 'reps_only', 'none').rir,
    ).toBeUndefined();
    expect(
      validateSetInput({ reps: 8, rir: 10 }, 'reps_only', 'none').rir,
    ).toBeUndefined();
    expect(validateSetInput({ reps: 8, rir: 11 }, 'reps_only', 'none').rir).toContain(
      '0 und 10',
    );
    expect(validateSetInput({ reps: 8, rir: -1 }, 'reps_only', 'none').rir).toContain(
      '0 und 10',
    );
  });

  it('keeps RPE between 1 and 10', () => {
    expect(
      validateSetInput({ reps: 8, rpe: 1 }, 'reps_only', 'none').rpe,
    ).toBeUndefined();
    expect(validateSetInput({ reps: 8, rpe: 0 }, 'reps_only', 'none').rpe).toContain(
      '1 und 10',
    );
    expect(validateSetInput({ reps: 8, rpe: 11 }, 'reps_only', 'none').rpe).toContain(
      '1 und 10',
    );
  });

  it('requires the fields that belong to the tracking type', () => {
    // A weighted set needs both numbers …
    const weighted = validateSetInput({}, 'weight_reps', 'total');
    expect(weighted.weightKg).toBeTruthy();
    expect(weighted.reps).toBeTruthy();

    // … a timed set needs the duration instead.
    const timed = validateSetInput({}, 'duration', 'none');
    expect(timed.durationSeconds).toBeTruthy();
    expect(timed.reps).toBeUndefined();
  });

  it('accepts a clean bodyweight set without any weight', () => {
    const errors = validateSetInput({ reps: 12 }, 'bodyweight_reps', 'added_weight');
    expect(hasErrors(errors)).toBe(false);
  });

  it('does not demand a weight when the exercise records none', () => {
    const errors = validateSetInput({ reps: 12 }, 'weight_reps', 'none');
    expect(errors.weightKg).toBeUndefined();
  });
});

describe('validateExerciseForm', () => {
  const valid = { name: 'Bankdrücken', weightMultiplier: 1, defaultRestSeconds: 120 };

  it('accepts a valid exercise', () => {
    expect(validateExerciseForm(valid)).toEqual({});
  });

  it('requires a name', () => {
    expect(validateExerciseForm({ ...valid, name: '   ' }).name).toBeTruthy();
  });

  it('rejects a duplicate name regardless of case', () => {
    expect(validateExerciseForm(valid, ['bankdrücken']).name).toContain(
      'existiert bereits',
    );
  });

  it('requires a positive weight multiplier', () => {
    expect(
      validateExerciseForm({ ...valid, weightMultiplier: 0 }).weightMultiplier,
    ).toBeTruthy();
    expect(
      validateExerciseForm({ ...valid, weightMultiplier: 2 }).weightMultiplier,
    ).toBeUndefined();
  });

  it('keeps the default rest within a sensible range', () => {
    expect(
      validateExerciseForm({ ...valid, defaultRestSeconds: -1 }).defaultRestSeconds,
    ).toBeTruthy();
    expect(
      validateExerciseForm({ ...valid, defaultRestSeconds: 4000 }).defaultRestSeconds,
    ).toBeTruthy();
  });
});
