import { describe, expect, it } from 'vitest';
import type { PlanSchedule, ScheduleEntry, WorkoutTemplate } from '@/types';
import {
  advanceCursor,
  cursorAfterCompletedWorkout,
  normalizeCursor,
  resolveScheduleState,
  weekdayIndexMon0,
} from '@/services/schedule';

const NOW = '2026-07-01T08:00:00.000Z';

function unit(id: string, name: string, position = 0): WorkoutTemplate {
  return {
    id,
    planId: 'plan-1',
    name,
    description: '',
    position,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function schedule(overrides: Partial<PlanSchedule> = {}): PlanSchedule {
  return {
    id: 'sched-1',
    planId: 'plan-1',
    mode: 'free-rotation',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function entry(
  overrides: Partial<ScheduleEntry> & Pick<ScheduleEntry, 'position'>,
): ScheduleEntry {
  return {
    id: `entry-${overrides.position}`,
    scheduleId: 'sched-1',
    type: 'workout',
    ...overrides,
  };
}

describe('weekdayIndexMon0', () => {
  it('maps Monday to 0 and Sunday to 6', () => {
    expect(weekdayIndexMon0(new Date('2026-07-20T12:00:00'))).toBe(0); // Monday
    expect(weekdayIndexMon0(new Date('2026-07-26T12:00:00'))).toBe(6); // Sunday
  });
});

describe('normalizeCursor', () => {
  it('wraps and clamps into range', () => {
    expect(normalizeCursor(0, 3)).toBe(0);
    expect(normalizeCursor(3, 3)).toBe(0);
    expect(normalizeCursor(4, 3)).toBe(1);
    expect(normalizeCursor(-1, 3)).toBe(2);
    expect(normalizeCursor(undefined, 3)).toBe(0);
    expect(normalizeCursor(2, 0)).toBe(0);
  });
});

describe('free rotation', () => {
  const units = [unit('a', 'Push', 0), unit('b', 'Pull', 1), unit('c', 'Beine', 2)];
  const entries = [
    entry({ position: 0, templateId: 'a' }),
    entry({ position: 1, templateId: 'b' }),
    entry({ position: 2, templateId: 'c' }),
  ];

  it('suggests the first unit when nothing was completed', () => {
    const state = resolveScheduleState({ schedule: schedule(), entries, units });
    expect(state.nextWorkout?.template?.name).toBe('Push');
  });

  it('advances to the day after the last completed unit', () => {
    const state = resolveScheduleState({
      schedule: schedule(),
      entries,
      units,
      lastCompletedTemplateId: 'a',
    });
    expect(state.nextWorkout?.template?.name).toBe('Pull');
  });

  it('wraps around after the last unit', () => {
    const state = resolveScheduleState({
      schedule: schedule(),
      entries,
      units,
      lastCompletedTemplateId: 'c',
    });
    expect(state.nextWorkout?.template?.name).toBe('Push');
  });

  it('restarts when the last trained unit was removed', () => {
    const state = resolveScheduleState({
      schedule: schedule(),
      entries,
      units,
      lastCompletedTemplateId: 'gone',
    });
    expect(state.nextWorkout?.template?.name).toBe('Push');
  });
});

describe('repeating cycle', () => {
  const units = [unit('a', 'Push', 0), unit('b', 'Pull', 1), unit('c', 'Beine', 2)];
  // Push, Pull, Pause, Beine, Pause
  const entries: ScheduleEntry[] = [
    entry({ position: 0, templateId: 'a' }),
    entry({ position: 1, templateId: 'b' }),
    entry({ position: 2, type: 'rest' }),
    entry({ position: 3, templateId: 'c' }),
    entry({ position: 4, type: 'rest' }),
  ];

  it('the current day follows the cursor', () => {
    const state = resolveScheduleState({
      schedule: schedule({ mode: 'repeating-cycle', cyclePosition: 2 }),
      entries,
      units,
    });
    expect(state.current?.type).toBe('rest');
    expect(state.current?.name).toBe('Pause');
  });

  it('next workout skips over rest days', () => {
    const state = resolveScheduleState({
      schedule: schedule({ mode: 'repeating-cycle', cyclePosition: 2 }),
      entries,
      units,
    });
    // Cursor on the rest after Pull -> next workout is Beine.
    expect(state.nextWorkout?.template?.name).toBe('Beine');
  });

  it('preview shows rest days in order and wraps around', () => {
    const state = resolveScheduleState({
      schedule: schedule({ mode: 'repeating-cycle', cyclePosition: 3 }),
      entries,
      units,
      previewCount: 5,
    });
    expect(state.upcoming.map((r) => r.name)).toEqual([
      'Beine',
      'Pause',
      'Push',
      'Pull',
      'Pause',
    ]);
  });

  it('advanceCursor wraps at the end of the cycle', () => {
    expect(advanceCursor(schedule({ cyclePosition: 4 }), entries.length)).toBe(0);
    expect(advanceCursor(schedule({ cyclePosition: 0 }), entries.length)).toBe(1);
  });

  describe('cursorAfterCompletedWorkout', () => {
    // Cycle: Push(0), Pull(1), Rest(2), Beine(3), Rest(4).
    const cycle: ScheduleEntry[] = [
      entry({ position: 0, templateId: 'a' }),
      entry({ position: 1, templateId: 'b' }),
      entry({ position: 2, type: 'rest' }),
      entry({ position: 3, templateId: 'c' }),
      entry({ position: 4, type: 'rest' }),
    ];

    it('moves one past the completed workout at the cursor', () => {
      expect(
        cursorAfterCompletedWorkout(schedule({ cyclePosition: 0 }), cycle, 'a'),
      ).toBe(1);
    });

    it('scans forward past a rest day to the matching workout', () => {
      // Cursor sits on the rest day at 2; completing Beine lands on 4.
      expect(
        cursorAfterCompletedWorkout(schedule({ cyclePosition: 2 }), cycle, 'c'),
      ).toBe(4);
    });

    it('wraps around when the match is behind the cursor', () => {
      expect(
        cursorAfterCompletedWorkout(schedule({ cyclePosition: 3 }), cycle, 'a'),
      ).toBe(1);
    });

    it('leaves the cursor unchanged for an off-cycle or unknown unit', () => {
      expect(
        cursorAfterCompletedWorkout(schedule({ cyclePosition: 2 }), cycle, 'zzz'),
      ).toBe(2);
      expect(
        cursorAfterCompletedWorkout(schedule({ cyclePosition: 1 }), cycle, undefined),
      ).toBe(1);
    });

    it('returns 0 for an empty cycle', () => {
      expect(cursorAfterCompletedWorkout(schedule({ cyclePosition: 3 }), [], 'a')).toBe(
        0,
      );
    });
  });
});

describe('weekly', () => {
  const units = [unit('a', 'Push', 0), unit('b', 'Pull', 1)];
  // Mon: Push, Tue: Pull, others unassigned.
  const entries: ScheduleEntry[] = [
    {
      id: 'e0',
      scheduleId: 'sched-1',
      position: 0,
      weekday: 0,
      type: 'workout',
      templateId: 'a',
    },
    {
      id: 'e1',
      scheduleId: 'sched-1',
      position: 1,
      weekday: 1,
      type: 'workout',
      templateId: 'b',
    },
    { id: 'e3', scheduleId: 'sched-1', position: 3, weekday: 3, type: 'rest' },
  ];

  it('current day is the workout assigned to today', () => {
    const monday = new Date('2026-07-20T09:00:00'); // Monday
    const state = resolveScheduleState({
      schedule: schedule({ mode: 'weekly' }),
      entries,
      units,
      today: monday,
    });
    expect(state.current?.template?.name).toBe('Push');
    expect(state.nextWorkout?.template?.name).toBe('Push');
  });

  it('an unassigned weekday surfaces as a free day but finds the next workout', () => {
    const wednesday = new Date('2026-07-22T09:00:00'); // Wednesday, unassigned
    const state = resolveScheduleState({
      schedule: schedule({ mode: 'weekly' }),
      entries,
      units,
      today: wednesday,
    });
    expect(state.current?.type).toBe('rest');
    // Next workout scanning forward wraps to Monday's Push.
    expect(state.nextWorkout?.template?.name).toBe('Push');
  });

  it('a rest weekday is shown as a pause', () => {
    const thursday = new Date('2026-07-23T09:00:00'); // Thursday -> rest entry
    const state = resolveScheduleState({
      schedule: schedule({ mode: 'weekly' }),
      entries,
      units,
      today: thursday,
    });
    expect(state.current?.type).toBe('rest');
  });

  it('moves past a workout already completed today', () => {
    const monday = new Date('2026-07-20T09:00:00');
    const state = resolveScheduleState({
      schedule: schedule({ mode: 'weekly' }),
      entries,
      units,
      today: monday,
      completedSessions: [
        {
          templateId: 'a',
          scheduleEntryId: 'e0',
          plannedDate: '2026-07-20',
          status: 'completed',
          startedAt: '2026-07-20T08:00:00.000Z',
          finishedAt: '2026-07-20T09:00:00.000Z',
        },
      ],
    });
    expect(state.completedToday?.template?.id).toBe('a');
    expect(state.nextWorkout?.template?.id).toBe('b');
    expect(state.nextWorkoutDayOffset).toBe(1);
  });
});
