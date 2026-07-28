import { describe, expect, it } from 'vitest';
import {
  buildSetContexts,
  computeAnalytics,
  computeExerciseSeries,
  computeMuscleGroupLoad,
  computeWeeklySeries,
  listTrackedExercises,
  UNASSIGNED_MUSCLE_GROUP,
  type AnalyticsDataset,
} from '@/services/analytics';
import { lastDaysRange } from '@/utils/date';
import {
  makeExercise,
  makeSession,
  makeSessionExercise,
  makeSet,
} from '@/tests/factories';

/** Builds a small but complete dataset spanning two sessions. */
function buildDataset(): AnalyticsDataset {
  const bench = makeExercise({
    id: 'ex-bench',
    name: 'Bankdrücken',
    primaryMuscleGroup: 'Brust',
    secondaryMuscleGroups: ['Trizeps'],
  });
  const pullup = makeExercise({
    id: 'ex-pullup',
    name: 'Klimmzüge',
    primaryMuscleGroup: 'Rücken',
    secondaryMuscleGroups: ['Bizeps'],
    trackingType: 'bodyweight_reps',
    weightMode: 'added_weight',
  });

  const sessionA = makeSession({ id: 's-a', startedAt: '2026-07-06T10:00:00.000Z' });
  const sessionB = makeSession({ id: 's-b', startedAt: '2026-07-13T10:00:00.000Z' });

  const benchA = makeSessionExercise({
    id: 'se-a1',
    sessionId: 's-a',
    exerciseId: 'ex-bench',
  });
  const pullupA = makeSessionExercise({
    id: 'se-a2',
    sessionId: 's-a',
    exerciseId: 'ex-pullup',
    order: 1,
    exerciseNameSnapshot: 'Klimmzüge',
    trackingTypeSnapshot: 'bodyweight_reps',
    weightModeSnapshot: 'added_weight',
  });
  const benchB = makeSessionExercise({
    id: 'se-b1',
    sessionId: 's-b',
    exerciseId: 'ex-bench',
  });

  return {
    exercises: [bench, pullup],
    sessions: [sessionA, sessionB],
    sessionExercises: [benchA, pullupA, benchB],
    sets: [
      makeSet({
        sessionExerciseId: 'se-a1',
        weightKg: 60,
        reps: 10,
        completedAt: '2026-07-06T10:05:00.000Z',
        restTargetSeconds: 120,
        restActualSeconds: 130,
      }),
      makeSet({
        sessionExerciseId: 'se-a1',
        position: 1,
        setType: 'warmup',
        weightKg: 40,
        reps: 10,
        completedAt: '2026-07-06T10:02:00.000Z',
      }),
      makeSet({
        sessionExerciseId: 'se-a2',
        weightKg: 0,
        reps: 8,
        completedAt: '2026-07-06T10:15:00.000Z',
        restTargetSeconds: 120,
        restActualSeconds: 100,
      }),
      makeSet({
        sessionExerciseId: 'se-b1',
        weightKg: 65,
        reps: 8,
        completedAt: '2026-07-13T10:05:00.000Z',
        restTargetSeconds: 120,
        restActualSeconds: 140,
      }),
    ],
  };
}

describe('buildSetContexts', () => {
  it('joins sets to their exercise and session', () => {
    expect(buildSetContexts(buildDataset())).toHaveLength(4);
  });

  it('drops sets whose parents are missing', () => {
    const dataset = buildDataset();
    dataset.sets.push(makeSet({ sessionExerciseId: 'does-not-exist' }));
    expect(buildSetContexts(dataset)).toHaveLength(4);
  });

  it('excludes the running session unless explicitly requested', () => {
    const dataset = buildDataset();
    dataset.sessions.push(
      makeSession({ id: 's-live', status: 'active', finishedAt: undefined }),
    );
    dataset.sessionExercises.push(
      makeSessionExercise({ id: 'se-live', sessionId: 's-live', exerciseId: 'ex-bench' }),
    );
    dataset.sets.push(makeSet({ sessionExerciseId: 'se-live' }));

    expect(buildSetContexts(dataset)).toHaveLength(4);
    expect(buildSetContexts(dataset, { includeActiveSession: true })).toHaveLength(5);
  });
});

describe('per-week rate over the whole history', () => {
  it('divides by the inclusive day span / 7, not rounded-up whole weeks', () => {
    // Four workouts spanning exactly 28 inclusive days (01 → 28 July).
    const exercise = makeExercise({ id: 'ex-1', name: 'Bankdrücken' });
    const days = ['2026-07-01', '2026-07-10', '2026-07-19', '2026-07-28'];
    const sessions = days.map((day, index) =>
      makeSession({ id: `s-${index}`, startedAt: `${day}T10:00:00` }),
    );
    const sessionExercises = days.map((_, index) =>
      makeSessionExercise({
        id: `se-${index}`,
        sessionId: `s-${index}`,
        exerciseId: 'ex-1',
      }),
    );
    const sets = days.map((_, index) =>
      makeSet({
        id: `set-${index}`,
        sessionExerciseId: `se-${index}`,
        weightKg: 60,
        reps: 8,
        completedAt: `${days[index]}T10:05:00`,
      }),
    );

    const analytics = computeAnalytics(
      { exercises: [exercise], sessions, sessionExercises, sets },
      null,
    );
    expect(analytics.trainingDays).toBe(4);
    // 28-day span → divisor 4 → exactly 1 training day per week (not 4/5 = 0.8).
    expect(analytics.trainingDaysPerWeek).toBeCloseTo(1, 5);
  });
});

describe('computeAnalytics', () => {
  it('summarises sessions, sets and volume for the whole history', () => {
    const analytics = computeAnalytics(buildDataset(), null);

    expect(analytics.sessionCount).toBe(2);
    expect(analytics.trainingDays).toBe(2);
    // Warm-up excluded: 60×10 + 65×8 = 1120; the pull-up carries no kg volume.
    expect(analytics.volume.volumeKg).toBe(1120);
    expect(analytics.workingSetCount).toBe(3);
    expect(analytics.totalReps).toBe(26);
    expect(analytics.setsWithoutVolume).toBe(1);
  });

  it('keeps cardio out of the strength metrics but reports it separately', () => {
    const dataset = buildDataset();
    const running = makeExercise({
      id: 'ex-run',
      name: 'Laufen',
      trackingType: 'cardio',
      cardioModality: 'running',
      weightMode: 'none',
    });
    dataset.exercises.push(running);
    dataset.sessionExercises.push(
      makeSessionExercise({
        id: 'se-run',
        sessionId: 's-a',
        exerciseId: 'ex-run',
        order: 5,
        exerciseNameSnapshot: 'Laufen',
        trackingTypeSnapshot: 'cardio',
        weightModeSnapshot: 'none',
        cardioModalitySnapshot: 'running',
      }),
    );
    dataset.sets.push(
      makeSet({
        sessionExerciseId: 'se-run',
        weightKg: undefined,
        reps: undefined,
        durationSeconds: 1800,
        distanceMeters: 6000,
        completedAt: '2026-07-06T11:00:00.000Z',
      }),
    );

    const analytics = computeAnalytics(dataset, null);
    // Strength metrics are unchanged by the cardio set…
    expect(analytics.volume.volumeKg).toBe(1120);
    expect(analytics.workingSetCount).toBe(3);
    // …and the cardio activity is not counted into any muscle group.
    expect(
      analytics.muscleGroups.some((group) => group.muscleGroup === 'Ganzkörper'),
    ).toBe(false);
    // Cardio is reported in its own block.
    expect(analytics.cardio.activities).toBe(1);
    expect(analytics.cardio.totalDistanceMeters).toBe(6000);
  });

  it('includes warm-up sets when asked to', () => {
    const analytics = computeAnalytics(buildDataset(), null, { includeWarmup: true });
    expect(analytics.volume.volumeKg).toBe(1520);
    expect(analytics.workingSetCount).toBe(4);
  });

  it('restricts every figure to the selected range', () => {
    const analytics = computeAnalytics(
      buildDataset(),
      lastDaysRange(3, new Date('2026-07-14T12:00:00.000Z')),
    );
    expect(analytics.sessionCount).toBe(1);
    expect(analytics.volume.volumeKg).toBe(520);
  });

  it('averages the session duration', () => {
    const analytics = computeAnalytics(buildDataset(), null);
    // Both factory sessions last one hour.
    expect(analytics.totalDurationSeconds).toBe(7200);
    expect(analytics.averageDurationSeconds).toBe(3600);
  });

  it('evaluates rest behaviour across the range', () => {
    const analytics = computeAnalytics(buildDataset(), null);
    expect(analytics.restStatistics.evaluatedSets).toBe(3);
    // (130-120) + (100-120) + (140-120) = 10 over three sets
    expect(analytics.restStatistics.averageDeviationSeconds).toBeCloseTo(10 / 3, 5);
    expect(analytics.restStatistics.targetMetRatio).toBeCloseTo(2 / 3, 5);
  });

  it('produces an empty but valid result for an empty database', () => {
    const analytics = computeAnalytics(
      { sessions: [], sessionExercises: [], sets: [], exercises: [] },
      null,
    );
    expect(analytics.sessionCount).toBe(0);
    expect(analytics.volume.volumeKg).toBe(0);
    expect(analytics.personalRecords).toEqual([]);
  });
});

describe('muscle group evaluation', () => {
  it('separates direct from indirect sets', () => {
    const dataset = buildDataset();
    const contexts = buildSetContexts(dataset).filter(
      (context) => context.set.setType !== 'warmup',
    );
    const exercisesById = new Map(
      dataset.exercises.map((exercise) => [exercise.id, exercise]),
    );
    const groups = computeMuscleGroupLoad(contexts, exercisesById);

    const chest = groups.find((group) => group.muscleGroup === 'Brust');
    const triceps = groups.find((group) => group.muscleGroup === 'Trizeps');

    expect(chest?.directSets).toBe(2);
    expect(chest?.volumeKg).toBe(1120);
    expect(triceps?.directSets).toBe(0);
    expect(triceps?.indirectSets).toBe(2);
  });

  it('falls back to a placeholder group for unassigned exercises', () => {
    const exercise = makeExercise({ id: 'ex-x', primaryMuscleGroup: '' });
    const groups = computeMuscleGroupLoad(
      [
        {
          set: makeSet(),
          sessionExercise: makeSessionExercise({ exerciseId: 'ex-x' }),
          session: makeSession(),
        },
      ],
      new Map([[exercise.id, exercise]]),
    );
    expect(groups[0].muscleGroup).toBe(UNASSIGNED_MUSCLE_GROUP);
  });
});

describe('weekly series', () => {
  it('buckets volume and sessions by calendar week', () => {
    const dataset = buildDataset();
    const contexts = buildSetContexts(dataset).filter(
      (context) => context.set.setType !== 'warmup',
    );
    const weekly = computeWeeklySeries(contexts, dataset.sessions);

    expect(weekly).toHaveLength(2);
    expect(weekly[0].volumeKg).toBe(600);
    expect(weekly[1].volumeKg).toBe(520);
    expect(weekly.every((week) => week.sessions === 1)).toBe(true);
  });
});

describe('computeExerciseSeries', () => {
  it('returns one point per session, sorted chronologically', () => {
    const series = computeExerciseSeries(buildDataset(), 'ex-bench', null);

    expect(series).toHaveLength(2);
    expect(series[0].volumeKg).toBe(600);
    expect(series[0].topSetLoadKg).toBe(60);
    expect(series[1].volumeKg).toBe(520);
  });

  it('reports null instead of zero when a metric is not meaningful', () => {
    const series = computeExerciseSeries(buildDataset(), 'ex-pullup', null);
    expect(series[0].volumeKg).toBeNull();
    expect(series[0].estimatedOneRepMax).toBeNull();
    expect(series[0].totalReps).toBe(8);
  });
});

describe('listTrackedExercises', () => {
  it('lists each exercise once, sorted by name', () => {
    const list = listTrackedExercises(buildDataset());
    expect(list.map((entry) => entry.name)).toEqual(['Bankdrücken', 'Klimmzüge']);
  });
});
