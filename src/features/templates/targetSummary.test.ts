import { describe, expect, it } from 'vitest';
import { summarizeExerciseTargets } from '@/features/templates/targetSummary';

const labels = {
  sets: (value: number) => `${value} Sätze`,
  intervals: (value: number) => `${value} Intervalle`,
  reps: (min: number, max: number) => `${min}–${max} Wdh.`,
  repsFrom: (min: number) => `ab ${min} Wdh.`,
  repsTo: (max: number) => `bis ${max} Wdh.`,
  duration: (seconds: number) => `${seconds} s`,
  distance: (meters: number) => `${meters} m`,
  rpe: (value: number) => `RPE ${value}`,
  rest: (seconds: number) => `Pause ${seconds} s`,
  noRest: () => 'ohne Pause',
};

const base = { targetSets: 3, restSeconds: 120 };

describe('summarizeExerciseTargets', () => {
  it('summarises sets, rep range and rest', () => {
    expect(
      summarizeExerciseTargets(
        { ...base, targetRepMin: 8, targetRepMax: 12 },
        'weight_reps',
        labels,
      ),
    ).toBe('3 Sätze · 8–12 Wdh. · Pause 120 s');
  });

  it('leaves out targets that are not set instead of guessing', () => {
    expect(summarizeExerciseTargets(base, 'weight_reps', labels)).toBe(
      '3 Sätze · Pause 120 s',
    );
  });

  it('reports an open-ended rep range from either side', () => {
    expect(
      summarizeExerciseTargets({ ...base, targetRepMin: 5 }, 'weight_reps', labels),
    ).toBe('3 Sätze · ab 5 Wdh. · Pause 120 s');
    expect(
      summarizeExerciseTargets({ ...base, targetRepMax: 15 }, 'weight_reps', labels),
    ).toBe('3 Sätze · bis 15 Wdh. · Pause 120 s');
  });

  it('uses the duration for a time-based strength hold', () => {
    expect(
      summarizeExerciseTargets(
        { ...base, targetDurationSeconds: 45, targetRepMin: 8 },
        'duration',
        labels,
      ),
    ).toBe('3 Sätze · 45 s · Pause 120 s');
  });

  it('speaks of intervals, distance and RPE for cardio', () => {
    expect(
      summarizeExerciseTargets(
        {
          targetSets: 4,
          restSeconds: 60,
          targetDurationSeconds: 300,
          targetDistanceMeters: 1000,
          targetRpe: 7,
        },
        'cardio',
        labels,
      ),
    ).toBe('4 Intervalle · 300 s · 1000 m · RPE 7 · Pause 60 s');
  });

  it('names a deliberate rest of zero instead of dropping it', () => {
    expect(
      summarizeExerciseTargets({ targetSets: 3, restSeconds: 0 }, 'weight_reps', labels),
    ).toBe('3 Sätze · ohne Pause');
  });
});
