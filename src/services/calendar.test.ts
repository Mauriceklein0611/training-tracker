import { describe, expect, it } from 'vitest';
import type { AnalyticsDataset } from '@/services/analytics';
import {
  buildCalendarCells,
  buildDayActivity,
  computeCurrentWeekExerciseProgress,
  computeWeekProgress,
  goalReached,
  hasAnyWeeklyGoal,
  intensityLevel,
  metricValue,
} from '@/services/calendar';
import { monthGridDays } from '@/utils/date';
import {
  makeExercise,
  makeSession,
  makeSessionExercise,
  makeSet,
  resetFactoryCounter,
} from '@/tests/factories';

/**
 * Timestamps use local time without a trailing "Z" so day/week bucketing is
 * stable regardless of the machine timezone the test runs in.
 */

interface Built {
  dataset: AnalyticsDataset;
}

function buildDataset(config: {
  sessions: { id: string; startedAt: string; finishedAt?: string; status?: 'active' | 'completed' }[];
  /** exerciseId + list of sessionIds it was performed in, with working set count each. */
  entries?: { exerciseId: string; sessionId: string; workingSets: number; warmupSets?: number }[];
}): Built {
  resetFactoryCounter();
  const exerciseIds = new Set((config.entries ?? []).map((entry) => entry.exerciseId));
  const exercises = [...exerciseIds].map((id) =>
    makeExercise({ id, name: `Übung ${id}` }),
  );

  const sessions = config.sessions.map((session) =>
    makeSession({
      id: session.id,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      status: session.status ?? 'completed',
    }),
  );

  const sessionExercises = [];
  const sets = [];
  let seIndex = 0;
  for (const entry of config.entries ?? []) {
    const seId = `se-${(seIndex += 1)}`;
    sessionExercises.push(
      makeSessionExercise({
        id: seId,
        sessionId: entry.sessionId,
        exerciseId: entry.exerciseId,
      }),
    );
    for (let i = 0; i < entry.workingSets; i += 1) {
      sets.push(
        makeSet({ id: `${seId}-w${i}`, sessionExerciseId: seId, position: i, setType: 'working' }),
      );
    }
    for (let i = 0; i < (entry.warmupSets ?? 0); i += 1) {
      sets.push(
        makeSet({
          id: `${seId}-u${i}`,
          sessionExerciseId: seId,
          position: 100 + i,
          setType: 'warmup',
        }),
      );
    }
  }

  return { dataset: { sessions, sessionExercises, sets, exercises } };
}

describe('buildDayActivity', () => {
  it('buckets sessions and working sets by local calendar day', () => {
    const { dataset } = buildDataset({
      sessions: [
        { id: 's1', startedAt: '2026-07-20T18:00:00', finishedAt: '2026-07-20T19:00:00' },
        { id: 's2', startedAt: '2026-07-22T09:00:00', finishedAt: '2026-07-22T10:30:00' },
      ],
      entries: [
        { exerciseId: 'e1', sessionId: 's1', workingSets: 3, warmupSets: 2 },
        { exerciseId: 'e1', sessionId: 's2', workingSets: 4 },
      ],
    });

    const days = buildDayActivity(dataset);
    expect(days.get('2026-07-20')?.sessionCount).toBe(1);
    // Warmup sets do not count towards the working-set intensity.
    expect(days.get('2026-07-20')?.workingSets).toBe(3);
    expect(days.get('2026-07-20')?.durationSeconds).toBe(3600);
    expect(days.get('2026-07-22')?.workingSets).toBe(4);
    expect(days.get('2026-07-22')?.durationSeconds).toBe(5400);
    // A day with no training is absent, not a zero entry.
    expect(days.has('2026-07-21')).toBe(false);
  });

  it('ignores active (still running) sessions', () => {
    const { dataset } = buildDataset({
      sessions: [{ id: 's1', startedAt: '2026-07-20T18:00:00', status: 'active' }],
      entries: [{ exerciseId: 'e1', sessionId: 's1', workingSets: 3 }],
    });
    expect(buildDayActivity(dataset).size).toBe(0);
  });
});

describe('intensityLevel', () => {
  it('maps zero to level 0 and grades the rest into four steps', () => {
    expect(intensityLevel(0, 8)).toBe(0);
    expect(intensityLevel(2, 8)).toBe(1);
    expect(intensityLevel(4, 8)).toBe(2);
    expect(intensityLevel(6, 8)).toBe(3);
    expect(intensityLevel(8, 8)).toBe(4);
  });

  it('treats any positive value as level 1 when there is no spread', () => {
    expect(intensityLevel(5, 0)).toBe(1);
  });
});

describe('buildCalendarCells', () => {
  it('flags today, future days and out-of-month padding', () => {
    const now = new Date('2026-07-15T12:00:00');
    const { dataset } = buildDataset({
      sessions: [{ id: 's1', startedAt: '2026-07-14T18:00:00', finishedAt: '2026-07-14T19:00:00' }],
      entries: [{ exerciseId: 'e1', sessionId: 's1', workingSets: 3 }],
    });
    const activity = buildDayActivity(dataset);
    const grid = monthGridDays(now);
    const cells = buildCalendarCells(grid, activity, 'sets', now.getMonth(), now);

    const flat = cells.flat();
    const today = flat.find((cell) => cell.day === '2026-07-15');
    expect(today?.isToday).toBe(true);
    expect(today?.isFuture).toBe(false);

    const trained = flat.find((cell) => cell.day === '2026-07-14');
    expect(trained?.level).toBe(4);
    expect(trained?.inMonth).toBe(true);

    const future = flat.find((cell) => cell.day === '2026-07-16');
    expect(future?.isFuture).toBe(true);

    // The grid starts on a Monday.
    expect(cells[0][0].date.getDay()).toBe(1);
  });
});

describe('computeWeekProgress', () => {
  it('aggregates sessions and working sets into the recent weeks and flags the current one', () => {
    const now = new Date('2026-07-22T12:00:00'); // Wednesday
    const { dataset } = buildDataset({
      sessions: [
        // current week (Mon 2026-07-20 …)
        { id: 'c1', startedAt: '2026-07-20T18:00:00', finishedAt: '2026-07-20T19:00:00' },
        { id: 'c2', startedAt: '2026-07-21T18:00:00', finishedAt: '2026-07-21T19:00:00' },
        // previous week
        { id: 'p1', startedAt: '2026-07-15T18:00:00', finishedAt: '2026-07-15T19:00:00' },
      ],
      entries: [
        { exerciseId: 'e1', sessionId: 'c1', workingSets: 3 },
        { exerciseId: 'e1', sessionId: 'c2', workingSets: 2 },
        { exerciseId: 'e1', sessionId: 'p1', workingSets: 4 },
      ],
    });

    const weeks = computeWeekProgress(dataset, 4, now);
    expect(weeks).toHaveLength(4);
    const current = weeks[weeks.length - 1];
    expect(current.isCurrentWeek).toBe(true);
    expect(current.sessions).toBe(2);
    expect(current.workingSets).toBe(5);

    const previous = weeks[weeks.length - 2];
    expect(previous.isCurrentWeek).toBe(false);
    expect(previous.sessions).toBe(1);
    expect(previous.workingSets).toBe(4);
  });
});

describe('computeCurrentWeekExerciseProgress', () => {
  it('counts only the current week and only the targeted exercise', () => {
    const now = new Date('2026-07-22T12:00:00');
    const { dataset } = buildDataset({
      sessions: [
        { id: 'c1', startedAt: '2026-07-20T18:00:00', finishedAt: '2026-07-20T19:00:00' },
        { id: 'c2', startedAt: '2026-07-21T18:00:00', finishedAt: '2026-07-21T19:00:00' },
        { id: 'old', startedAt: '2026-07-10T18:00:00', finishedAt: '2026-07-10T19:00:00' },
      ],
      entries: [
        { exerciseId: 'squat', sessionId: 'c1', workingSets: 3 },
        { exerciseId: 'squat', sessionId: 'c2', workingSets: 2 },
        { exerciseId: 'bench', sessionId: 'c1', workingSets: 1 },
        { exerciseId: 'squat', sessionId: 'old', workingSets: 5 },
      ],
    });

    const progress = computeCurrentWeekExerciseProgress(
      dataset,
      [{ exerciseId: 'squat', exerciseNameSnapshot: 'Kniebeuge', sessionsPerWeek: 2 }],
      now,
    );
    expect(progress).toHaveLength(1);
    expect(progress[0].sessions).toBe(2); // c1 + c2, not the old session
    expect(progress[0].workingSets).toBe(5); // 3 + 2
  });
});

describe('goal helpers', () => {
  it('goalReached is false without a goal and true once met', () => {
    expect(goalReached(3, undefined)).toBe(false);
    expect(goalReached(2, 3)).toBe(false);
    expect(goalReached(3, 3)).toBe(true);
    expect(goalReached(4, 3)).toBe(true);
  });

  it('hasAnyWeeklyGoal detects overall and per-exercise goals', () => {
    expect(hasAnyWeeklyGoal(undefined)).toBe(false);
    expect(hasAnyWeeklyGoal({})).toBe(false);
    expect(hasAnyWeeklyGoal({ sessionsPerWeek: 3 })).toBe(true);
    expect(
      hasAnyWeeklyGoal({
        exerciseGoals: [{ exerciseId: 'x', exerciseNameSnapshot: 'X', workingSetsPerWeek: 6 }],
      }),
    ).toBe(true);
    expect(
      hasAnyWeeklyGoal({ exerciseGoals: [{ exerciseId: 'x', exerciseNameSnapshot: 'X' }] }),
    ).toBe(false);
  });
});

describe('metricValue', () => {
  it('selects the field matching the metric', () => {
    const activity = {
      day: '2026-07-20',
      sessionCount: 1,
      workingSets: 7,
      durationSeconds: 3600,
      volumeKg: 100,
      sessionIds: ['s1'],
    };
    expect(metricValue(activity, 'sessions')).toBe(1);
    expect(metricValue(activity, 'sets')).toBe(7);
    expect(metricValue(activity, 'duration')).toBe(3600);
  });
});
