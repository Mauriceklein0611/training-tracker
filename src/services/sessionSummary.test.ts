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
