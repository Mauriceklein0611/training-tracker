import { describe, expect, it } from 'vitest';
import { summarizeSession } from '@/services/sessionSummary';
import type { AnalyticsDataset } from '@/services/analytics';
import {
  makeExercise,
  makeSession,
  makeSessionExercise,
  makeSet,
} from '@/tests/factories';

/** A mixed session: one strength exercise and one cardio activity. */
function mixedDataset(): AnalyticsDataset {
  const bench = makeExercise({ id: 'ex-bench', name: 'Bankdrücken' });
  const running = makeExercise({
    id: 'ex-run',
    name: 'Laufen',
    trackingType: 'cardio',
    cardioModality: 'running',
    weightMode: 'none',
  });
  const session = makeSession({ id: 's1', startedAt: '2026-07-06T10:00:00.000Z' });

  const benchSe = makeSessionExercise({
    id: 'se-bench',
    sessionId: 's1',
    exerciseId: 'ex-bench',
  });
  const runSe = makeSessionExercise({
    id: 'se-run',
    sessionId: 's1',
    exerciseId: 'ex-run',
    order: 1,
    exerciseNameSnapshot: 'Laufen',
    trackingTypeSnapshot: 'cardio',
    weightModeSnapshot: 'none',
    cardioModalitySnapshot: 'running',
  });

  return {
    exercises: [bench, running],
    sessions: [session],
    sessionExercises: [benchSe, runSe],
    sets: [
      makeSet({
        id: 'set-bench',
        sessionExerciseId: 'se-bench',
        weightKg: 60,
        reps: 10,
        completedAt: '2026-07-06T10:05:00.000Z',
      }),
      makeSet({
        id: 'set-run',
        sessionExerciseId: 'se-run',
        weightKg: undefined,
        reps: undefined,
        durationSeconds: 1800,
        distanceMeters: 6000,
        averageHeartRateBpm: 150,
        rpe: 6,
        completedAt: '2026-07-06T10:40:00.000Z',
      }),
    ],
  };
}

describe('summarizeSession — strength and cardio stay separate', () => {
  it('reports cardio totals without mixing them into strength', () => {
    const summary = summarizeSession(mixedDataset(), 's1')!;
    // Strength: one working set of 60 kg × 10 = 600 kg volume; cardio excluded.
    expect(summary.workingSetCount).toBe(1);
    expect(summary.volume.volumeKg).toBe(600);
    // Both exercises counted.
    expect(summary.exerciseCount).toBe(2);
    // Cardio block is populated and separate.
    expect(summary.hasCardio).toBe(true);
    expect(summary.cardio.activities).toBe(1);
    expect(summary.cardio.totalDurationSeconds).toBe(1800);
    expect(summary.cardio.totalDistanceMeters).toBe(6000);
    expect(summary.cardio.averageHeartRateBpm).toBe(150);
    // A mixed session has strength content, so it does not lead with cardio.
    expect(summary.hasStrength).toBe(true);
    // Single modality → a session pace is reported (1800 s / 6 km = 5:00 min/km).
    expect(summary.cardioModality).toBe('running');
    expect(summary.cardioPace).toEqual({ kind: 'min_per_km', value: 5 });
    // Cardio RPE is averaged from the cardio section only (strength has none).
    expect(summary.cardioAvgRpe).toBe(6);
  });

  it('a cardio-only session leads with cardio and reports a pace', () => {
    const dataset = mixedDataset();
    // Drop the strength set → cardio-only session.
    dataset.sets = dataset.sets.filter((set) => set.id !== 'set-bench');
    const summary = summarizeSession(dataset, 's1')!;
    expect(summary.workingSetCount).toBe(0);
    expect(summary.volume.volumeKg).toBe(0);
    expect(summary.hasCardio).toBe(true);
    // No strength content → the view leads with cardio and hides the 0/– grid.
    expect(summary.hasStrength).toBe(false);
    expect(summary.cardio.activities).toBe(1);
    expect(summary.cardioPace).toEqual({ kind: 'min_per_km', value: 5 });
    // No fabricated strength records.
    expect(summary.newRecords).toEqual([]);
  });

  it('compares against the last session of the same plan day', () => {
    // Two Bankdrücken sessions of the same plan day (templateId "day-a").
    const bench = makeExercise({ id: 'ex-bench', name: 'Bankdrücken' });
    const older = makeSession({
      id: 's-old',
      templateId: 'day-a',
      startedAt: '2026-07-01T10:00:00.000Z',
    });
    const newer = makeSession({
      id: 's-new',
      templateId: 'day-a',
      startedAt: '2026-07-08T10:00:00.000Z',
    });
    const dataset: AnalyticsDataset = {
      exercises: [bench],
      sessions: [older, newer],
      sessionExercises: [
        makeSessionExercise({ id: 'se-old', sessionId: 's-old', exerciseId: 'ex-bench' }),
        makeSessionExercise({ id: 'se-new', sessionId: 's-new', exerciseId: 'ex-bench' }),
      ],
      sets: [
        // Older: 50 × 10 = 500 kg volume.
        makeSet({
          id: 'set-old',
          sessionExerciseId: 'se-old',
          weightKg: 50,
          reps: 10,
          completedAt: '2026-07-01T10:05:00.000Z',
        }),
        // Newer: 55 × 10 = 550 kg → +10 %.
        makeSet({
          id: 'set-new',
          sessionExerciseId: 'se-new',
          weightKg: 55,
          reps: 10,
          completedAt: '2026-07-08T10:05:00.000Z',
        }),
      ],
    };

    const summary = summarizeSession(dataset, 's-new')!;
    expect(summary.previousComparable?.sessionId).toBe('s-old');
    expect(summary.previousComparable?.volumeDeltaPercent).toBeCloseTo(10, 5);

    // The first-ever session of a day has nothing comparable before it.
    const first = summarizeSession(dataset, 's-old')!;
    expect(first.previousComparable).toBeNull();
  });

  it('has no comparable for a free workout (no plan day / unit)', () => {
    const dataset = mixedDataset();
    // The factory session has no templateId/workoutUnitTemplateId → not comparable.
    const summary = summarizeSession(dataset, 's1')!;
    expect(summary.previousComparable).toBeNull();
  });

  it('reports no session pace when cardio modalities differ', () => {
    const dataset = mixedDataset();
    dataset.sets = dataset.sets.filter((set) => set.id !== 'set-bench');
    // Add a second cardio activity of a different modality (rowing).
    dataset.exercises.push(
      makeExercise({
        id: 'ex-row',
        name: 'Rudern',
        trackingType: 'cardio',
        cardioModality: 'rowing',
        weightMode: 'none',
      }),
    );
    dataset.sessionExercises.push(
      makeSessionExercise({
        id: 'se-row',
        sessionId: 's1',
        exerciseId: 'ex-row',
        order: 2,
        exerciseNameSnapshot: 'Rudern',
        trackingTypeSnapshot: 'cardio',
        weightModeSnapshot: 'none',
        cardioModalitySnapshot: 'rowing',
      }),
    );
    dataset.sets.push(
      makeSet({
        id: 'set-row',
        sessionExerciseId: 'se-row',
        weightKg: undefined,
        reps: undefined,
        durationSeconds: 1200,
        distanceMeters: 5000,
        completedAt: '2026-07-06T11:10:00.000Z',
      }),
    );
    const summary = summarizeSession(dataset, 's1')!;
    expect(summary.cardio.activities).toBe(2);
    expect(summary.cardioModality).toBeUndefined();
    expect(summary.cardioPace).toBeNull();
  });
});

describe('summarizeSession — estimated calories', () => {
  it('reports no estimate without a body weight recorded by that day', () => {
    expect(summarizeSession(mixedDataset(), 's1')!.calories).toBeNull();

    const dataset = mixedDataset();
    // A weigh-in *after* the session must not be applied retroactively.
    dataset.bodyWeightEntries = [
      {
        id: 'bw-late',
        date: '2026-08-01',
        weightKg: 80,
        notes: '',
        createdAt: '2026-08-01T07:00:00.000Z',
        updatedAt: '2026-08-01T07:00:00.000Z',
      },
    ];
    expect(summarizeSession(dataset, 's1')!.calories).toBeNull();
  });

  it('estimates strength and cardio from the weight valid on the day', () => {
    const dataset = mixedDataset();
    dataset.bodyWeightEntries = [
      {
        id: 'bw',
        date: '2026-07-01',
        weightKg: 80,
        notes: '',
        createdAt: '2026-07-01T07:00:00.000Z',
        updatedAt: '2026-07-01T07:00:00.000Z',
      },
    ];

    const calories = summarizeSession(dataset, 's1')!.calories!;
    // 10 reps × 3 s at 5 MET plus 1800 s of running at 9.8 MET, 80 kg.
    const strength = (5 * 80 * 0.0175 * 30) / 60;
    const running = (9.8 * 80 * 0.0175 * 1800) / 60;
    expect(calories.kcal).toBeCloseTo(strength + running, 6);
    expect(calories.recordedKcal).toBe(0);
  });
});
