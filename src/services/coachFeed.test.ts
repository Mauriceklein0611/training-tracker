import { describe, expect, it } from 'vitest';
import type { AnalyticsDataset } from '@/services/analytics';
import { buildCoachInsights } from '@/services/coachFeed';
import {
  makeExercise,
  makeSession,
  makeSessionExercise,
  makeSet,
} from '@/tests/factories';

const NOW = new Date('2026-07-28T12:00:00.000Z');

/** Builds a dataset from a list of strength sessions on given day keys. */
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

describe('buildCoachInsights', () => {
  it('returns nothing for an empty dataset', () => {
    expect(
      buildCoachInsights(
        { exercises: [], sessions: [], sessionExercises: [], sets: [] },
        NOW,
      ),
    ).toEqual([]);
  });

  it('reports a positive frequency insight with a stated basis', () => {
    const dataset = datasetFromDays([
      // This week (last 7 days: 22.–28.07).
      { day: '2026-07-23', weightKg: 60 },
      { day: '2026-07-25', weightKg: 60 },
      // Prior 4 weeks (24.06–21.07): one session → 0.25/week baseline.
      { day: '2026-07-10', weightKg: 50 },
    ]);
    const insights = buildCoachInsights(dataset, NOW);
    const frequency = insights.find((insight) => insight.id.startsWith('frequency'));
    expect(frequency?.id).toBe('frequency-up');
    // Every insight explains why it appears (basis + timeframe).
    for (const insight of insights) {
      expect(insight.why.length).toBeGreaterThan(0);
    }
  });

  it('caps the number of insights', () => {
    const dataset = datasetFromDays([
      { day: '2026-07-23', weightKg: 80 },
      { day: '2026-07-25', weightKg: 80 },
      { day: '2026-07-18', weightKg: 40 },
      { day: '2026-07-10', weightKg: 40 },
    ]);
    expect(buildCoachInsights(dataset, NOW, 2).length).toBeLessThanOrEqual(2);
  });
});
