import { describe, expect, it } from 'vitest';
import type { AnalyticsDataset } from '@/services/analytics';
import { buildPeriodReview, previousPeriod } from '@/services/periodReview';
import { customRange } from '@/utils/date';
import {
  makeExercise,
  makeSession,
  makeSessionExercise,
  makeSet,
} from '@/tests/factories';

const NOW = new Date('2026-07-31T12:00:00.000Z');

function datasetFromDays(days: { day: string; weightKg: number }[]): AnalyticsDataset {
  const bench = makeExercise({ id: 'ex-bench', name: 'Bankdrücken' });
  const sessions = days.map((d, i) =>
    makeSession({ id: `s${i}`, startedAt: `${d.day}T10:00:00.000Z` }),
  );
  const sessionExercises = days.map((_, i) =>
    makeSessionExercise({ id: `se${i}`, sessionId: `s${i}`, exerciseId: 'ex-bench' }),
  );
  const sets = days.map((d, i) =>
    makeSet({
      id: `set${i}`,
      sessionExerciseId: `se${i}`,
      weightKg: d.weightKg,
      reps: 10,
      completedAt: `${d.day}T10:05:00.000Z`,
    }),
  );
  return { exercises: [bench], sessions, sessionExercises, sets };
}

describe('previousPeriod', () => {
  it('is the equally long span ending the day before the range starts', () => {
    const july = customRange('2026-07-01', '2026-07-31'); // 31 days
    const prev = previousPeriod(july);
    expect([
      prev.from.getFullYear(),
      prev.from.getMonth() + 1,
      prev.from.getDate(),
    ]).toEqual([2026, 5, 31]); // 2026-05-31
    expect([prev.to.getFullYear(), prev.to.getMonth() + 1, prev.to.getDate()]).toEqual([
      2026, 6, 30,
    ]); // 2026-06-30
  });
});

describe('buildPeriodReview', () => {
  it('summarises the period and compares volume with the previous one', () => {
    const dataset = datasetFromDays([
      // July (current): two sessions, 55 & 60 kg × 10 = 1150 kg volume.
      { day: '2026-07-10', weightKg: 55 },
      { day: '2026-07-20', weightKg: 60 },
      // June (previous): one session, 50 × 10 = 500 kg volume.
      { day: '2026-06-15', weightKg: 50 },
    ]);
    const review = buildPeriodReview(
      dataset,
      customRange('2026-07-01', '2026-07-31'),
      NOW,
    );
    expect(review.sessions).toBe(2);
    expect(review.volumeKg).toBe(1150);
    expect(review.topMuscleGroups).toContain('Brust');
    // 1150 vs 500 → +130 %.
    expect(review.volumeDeltaPercent).toBe(130);
  });

  it('reports null deltas when the previous period was empty', () => {
    const dataset = datasetFromDays([{ day: '2026-07-10', weightKg: 55 }]);
    const review = buildPeriodReview(
      dataset,
      customRange('2026-07-01', '2026-07-31'),
      NOW,
    );
    expect(review.sessionsDeltaPercent).toBeNull();
    expect(review.volumeDeltaPercent).toBeNull();
  });
});
