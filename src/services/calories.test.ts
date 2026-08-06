import { describe, expect, it } from 'vitest';
import {
  estimateExerciseCalories,
  estimateSessionCalories,
  KCAL_PER_MET_MINUTE_PER_KG,
  MAX_COUNTED_REST_SECONDS,
  resolveBodyWeightKg,
  SECONDS_PER_REP,
} from '@/services/calories';
import { makeSessionExercise, makeSet } from '@/tests/factories';

/** kcal of `seconds` at `met` for an 80 kg person, as the model defines it. */
function expected(met: number, seconds: number, kg = 80): number {
  return (met * kg * KCAL_PER_MET_MINUTE_PER_KG * seconds) / 60;
}

describe('resolveBodyWeightKg', () => {
  const entries = [
    { date: '2026-01-10', weightKg: 80 },
    { date: '2026-03-01', weightKg: 82 },
    { date: '2026-05-01', weightKg: undefined },
  ];

  it('uses the most recent weight recorded on or before the day', () => {
    expect(resolveBodyWeightKg(entries, '2026-04-02T18:00:00.000Z')).toBe(82);
    expect(resolveBodyWeightKg(entries, '2026-02-02T18:00:00.000Z')).toBe(80);
  });

  it('counts an entry made on the same day', () => {
    expect(resolveBodyWeightKg(entries, '2026-03-01T06:00:00.000Z')).toBe(82);
  });

  it('never reaches forward to a later weight', () => {
    expect(resolveBodyWeightKg(entries, '2025-12-31T10:00:00.000Z')).toBeNull();
  });

  it('ignores entries that carry no weight', () => {
    expect(resolveBodyWeightKg([{ date: '2026-01-01' }], '2026-06-01')).toBeNull();
  });
});

describe('estimateExerciseCalories', () => {
  const context = makeSessionExercise();

  it('derives strength work from the repetitions when no duration was recorded', () => {
    const estimate = estimateExerciseCalories(
      [makeSet({ reps: 10, restActualSeconds: 0 })],
      context,
      80,
    );
    expect(estimate?.workSeconds).toBe(10 * SECONDS_PER_REP);
    expect(estimate?.kcal).toBeCloseTo(expected(5, 30), 6);
  });

  it('adds the recorded rest at a resting rate', () => {
    const estimate = estimateExerciseCalories(
      [makeSet({ reps: 10, restActualSeconds: 120 })],
      context,
      80,
    );
    expect(estimate?.restSeconds).toBe(120);
    expect(estimate?.kcal).toBeCloseTo(expected(5, 30) + expected(1.5, 120), 6);
  });

  it('caps a single rest that was never ended', () => {
    const estimate = estimateExerciseCalories(
      [makeSet({ reps: 10, restActualSeconds: 4000 })],
      context,
      80,
    );
    expect(estimate?.restSeconds).toBe(MAX_COUNTED_REST_SECONDS);
  });

  it('scales with the body weight', () => {
    const light = estimateExerciseCalories([makeSet({ reps: 10 })], context, 60);
    const heavy = estimateExerciseCalories([makeSet({ reps: 10 })], context, 120);
    expect(heavy!.kcal).toBeCloseTo(light!.kcal * 2, 6);
  });

  it('uses the recorded duration of a hold instead of repetitions', () => {
    const hold = makeSessionExercise({ trackingTypeSnapshot: 'duration' });
    const estimate = estimateExerciseCalories(
      [makeSet({ reps: undefined, weightKg: undefined, durationSeconds: 60 })],
      hold,
      80,
    );
    expect(estimate?.workSeconds).toBe(60);
    expect(estimate?.kcal).toBeCloseTo(expected(4, 60), 6);
  });

  it('estimates cardio from its modality and duration', () => {
    const cardio = makeSessionExercise({
      trackingTypeSnapshot: 'cardio',
      cardioModalitySnapshot: 'running',
    });
    const estimate = estimateExerciseCalories(
      [
        makeSet({
          reps: undefined,
          weightKg: undefined,
          durationSeconds: 600,
          distanceMeters: 2000,
        }),
      ],
      cardio,
      80,
    );
    expect(estimate?.kcal).toBeCloseTo(expected(9.8, 600), 6);
  });

  it('never overrides a manually recorded cardio value', () => {
    const cardio = makeSessionExercise({
      trackingTypeSnapshot: 'cardio',
      cardioModalitySnapshot: 'cycling',
    });
    const estimate = estimateExerciseCalories(
      [
        makeSet({
          reps: undefined,
          weightKg: undefined,
          durationSeconds: 600,
          caloriesKcal: 123,
        }),
      ],
      cardio,
      80,
    );
    expect(estimate?.kcal).toBe(123);
    expect(estimate?.recordedKcal).toBe(123);
  });

  it('counts only completed sets and returns null without any', () => {
    expect(
      estimateExerciseCalories([makeSet({ completedAt: undefined })], context, 80),
    ).toBeNull();
  });

  it('returns null when no body weight is known', () => {
    expect(estimateExerciseCalories([makeSet({ reps: 10 })], context, null)).toBeNull();
    expect(estimateExerciseCalories([makeSet({ reps: 10 })], context, 0)).toBeNull();
  });

  it('includes warm-up sets, which cost energy too', () => {
    const estimate = estimateExerciseCalories(
      [makeSet({ setType: 'warmup', reps: 10 }), makeSet({ reps: 10 })],
      context,
      80,
    );
    expect(estimate?.workSeconds).toBe(2 * 10 * SECONDS_PER_REP);
  });
});

describe('estimateSessionCalories', () => {
  it('sums the exercises of a workout', () => {
    const context = makeSessionExercise();
    const single = estimateExerciseCalories([makeSet({ reps: 10 })], context, 80)!;
    const total = estimateSessionCalories(
      [
        { sets: [makeSet({ reps: 10 })], context },
        { sets: [makeSet({ reps: 10 })], context },
      ],
      80,
    );
    expect(total?.kcal).toBeCloseTo(single.kcal * 2, 6);
  });

  it('is null when nothing could be estimated', () => {
    const context = makeSessionExercise();
    expect(
      estimateSessionCalories(
        [{ sets: [makeSet({ completedAt: undefined })], context }],
        80,
      ),
    ).toBeNull();
    expect(estimateSessionCalories([], 80)).toBeNull();
  });
});
