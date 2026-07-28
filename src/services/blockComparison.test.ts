import { describe, expect, it } from 'vitest';
import type { AnalyticsDataset } from '@/services/analytics';
import {
  buildBlockComparisonExport,
  compareBlocks,
  computeBlockMetrics,
} from '@/services/blockComparison';
import type { BodyWeightEntry } from '@/types';
import { customRange } from '@/utils/date';
import {
  makeExercise,
  makeSession,
  makeSessionExercise,
  makeSet,
  resetFactoryCounter,
} from '@/tests/factories';

/**
 * Builds a dataset of N one-exercise sessions, each on a given local day with a
 * fixed number of working sets.
 */
function datasetFor(
  sessions: { id: string; day: string; workingSets: number; rir?: number }[],
): AnalyticsDataset {
  resetFactoryCounter();
  const exercise = makeExercise({ id: 'ex1', name: 'Bankdrücken' });
  const sessionRows = sessions.map((session) =>
    makeSession({
      id: session.id,
      startedAt: `${session.day}T18:00:00`,
      finishedAt: `${session.day}T19:00:00`,
    }),
  );
  const sessionExercises = sessions.map((session) =>
    makeSessionExercise({
      id: `se-${session.id}`,
      sessionId: session.id,
      exerciseId: 'ex1',
    }),
  );
  const sets = sessions.flatMap((session) =>
    Array.from({ length: session.workingSets }, (_, i) =>
      makeSet({
        id: `${session.id}-s${i}`,
        sessionExerciseId: `se-${session.id}`,
        position: i,
        setType: 'working',
        weightKg: 100,
        reps: 10,
        rir: session.rir,
        completedAt: `${session.day}T18:${10 + i}:00`,
      }),
    ),
  );
  return { exercises: [exercise], sessions: sessionRows, sessionExercises, sets };
}

const NO_BODY: BodyWeightEntry[] = [];

describe('computeBlockMetrics', () => {
  it('summarises a block and normalises to per-week values', () => {
    // Two weeks, one session per week, 3 working sets each.
    const dataset = datasetFor([
      { id: 'a1', day: '2026-07-06', workingSets: 3, rir: 2 },
      { id: 'a2', day: '2026-07-13', workingSets: 3, rir: 2 },
    ]);
    const range = customRange('2026-07-06', '2026-07-19'); // 2 calendar weeks
    const metrics = computeBlockMetrics(dataset, NO_BODY, range, 'A');

    expect(metrics.sessions).toBe(2);
    expect(metrics.workingSets).toBe(6);
    expect(metrics.weeks).toBe(2);
    expect(metrics.sessionsPerWeek).toBe(1);
    expect(metrics.workingSetsPerWeek).toBe(3);
    expect(metrics.avgRir).toBe(2);
    expect(metrics.distinctExercises).toBe(1);
  });

  it('keeps cardio in its own block section, out of the strength metrics', () => {
    resetFactoryCounter();
    const bench = makeExercise({ id: 'ex1', name: 'Bankdrücken' });
    const running = makeExercise({
      id: 'ex-run',
      name: 'Laufen',
      trackingType: 'cardio',
      cardioModality: 'running',
      weightMode: 'none',
    });
    const session = makeSession({
      id: 's1',
      startedAt: '2026-07-06T18:00:00',
      finishedAt: '2026-07-06T19:00:00',
    });
    const dataset: AnalyticsDataset = {
      exercises: [bench, running],
      sessions: [session],
      sessionExercises: [
        makeSessionExercise({ id: 'se-str', sessionId: 's1', exerciseId: 'ex1' }),
        makeSessionExercise({
          id: 'se-run',
          sessionId: 's1',
          exerciseId: 'ex-run',
          order: 1,
          exerciseNameSnapshot: 'Laufen',
          trackingTypeSnapshot: 'cardio',
          weightModeSnapshot: 'none',
          cardioModalitySnapshot: 'running',
        }),
      ],
      sets: [
        makeSet({
          sessionExerciseId: 'se-str',
          weightKg: 100,
          reps: 10,
          completedAt: '2026-07-06T18:10:00',
        }),
        makeSet({
          sessionExerciseId: 'se-run',
          weightKg: undefined,
          reps: undefined,
          durationSeconds: 1800,
          distanceMeters: 6000,
          completedAt: '2026-07-06T18:40:00',
        }),
      ],
    };
    const metrics = computeBlockMetrics(
      dataset,
      NO_BODY,
      customRange('2026-07-06', '2026-07-12'),
      'A',
    );
    // Strength side ignores the cardio activity.
    expect(metrics.workingSets).toBe(1);
    expect(metrics.distinctExercises).toBe(1);
    // Cardio side has its own figures.
    expect(metrics.cardioActivities).toBe(1);
    expect(metrics.cardioDistanceMeters).toBe(6000);
    expect(metrics.cardioDurationSeconds).toBe(1800);
  });

  it('reports missing subjective and body data as null', () => {
    const dataset = datasetFor([{ id: 'a1', day: '2026-07-06', workingSets: 3 }]);
    const metrics = computeBlockMetrics(
      dataset,
      NO_BODY,
      customRange('2026-07-06', '2026-07-12'),
      'A',
    );
    expect(metrics.avgRir).toBeNull();
    expect(metrics.avgRpe).toBeNull();
    expect(metrics.avgBodyWeightKg).toBeNull();
  });

  it('averages body weight only from entries inside the block', () => {
    const dataset = datasetFor([{ id: 'a1', day: '2026-07-06', workingSets: 3 }]);
    const body: BodyWeightEntry[] = [
      {
        id: 'b1',
        date: '2026-07-07',
        weightKg: 80,
        notes: '',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'b2',
        date: '2026-07-09',
        weightKg: 82,
        notes: '',
        createdAt: '',
        updatedAt: '',
      },
      // Outside the block:
      {
        id: 'b3',
        date: '2026-08-01',
        weightKg: 90,
        notes: '',
        createdAt: '',
        updatedAt: '',
      },
    ];
    const metrics = computeBlockMetrics(
      dataset,
      body,
      customRange('2026-07-06', '2026-07-12'),
      'A',
    );
    expect(metrics.avgBodyWeightKg).toBe(81);
  });
});

describe('compareBlocks', () => {
  it('normalises fairly when the blocks have different lengths', () => {
    // Block A: 1 week, 2 sessions. Block B: 2 weeks, 2 sessions.
    const dataset = datasetFor([
      { id: 'a1', day: '2026-07-06', workingSets: 4 },
      { id: 'a2', day: '2026-07-08', workingSets: 4 },
      { id: 'b1', day: '2026-07-20', workingSets: 4 },
      { id: 'b2', day: '2026-07-29', workingSets: 4 },
    ]);
    const comparison = compareBlocks(
      dataset,
      NO_BODY,
      customRange('2026-07-06', '2026-07-12'), // 1 week
      customRange('2026-07-20', '2026-08-02'), // 2 weeks
    );

    expect(comparison.a.sessions).toBe(2);
    expect(comparison.b.sessions).toBe(2);
    // Same absolute sessions, but A is twice as dense per week.
    expect(comparison.a.sessionsPerWeek).toBe(2);
    expect(comparison.b.sessionsPerWeek).toBe(1);
  });
});

describe('buildBlockComparisonExport', () => {
  it('states both blocks and a plain per-week difference without conclusions', () => {
    const dataset = datasetFor([
      { id: 'a1', day: '2026-07-06', workingSets: 4 },
      { id: 'b1', day: '2026-07-20', workingSets: 6 },
    ]);
    const comparison = compareBlocks(
      dataset,
      NO_BODY,
      customRange('2026-07-06', '2026-07-12'),
      customRange('2026-07-20', '2026-07-26'),
    );
    const exported = buildBlockComparisonExport(comparison) as {
      differencePerWeek: { workingSets: number };
      note: string;
    };
    expect(exported.differencePerWeek.workingSets).toBe(2); // 6 − 4
    expect(exported.note).toContain('keine Bewertung');
  });
});
