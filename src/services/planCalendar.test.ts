import { describe, expect, it } from 'vitest';
import { buildPlanCalendarMonth } from '@/services/planCalendar';
import type {
  PlanSchedule,
  ScheduleEntry,
  WorkoutSession,
  WorkoutTemplate,
} from '@/types';

const NOW = '2026-07-01T08:00:00.000Z';

function unit(id: string, name: string, position = 0): WorkoutTemplate {
  return {
    id,
    planId: 'p',
    name,
    description: '',
    position,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function schedule(overrides: Partial<PlanSchedule> = {}): PlanSchedule {
  return {
    id: 's',
    planId: 'p',
    mode: 'repeating-cycle',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function entry(
  overrides: Partial<ScheduleEntry> & Pick<ScheduleEntry, 'position'>,
): ScheduleEntry {
  return { id: `e${overrides.position}`, scheduleId: 's', type: 'workout', ...overrides };
}

function session(day: string, name = 'Push'): WorkoutSession {
  return {
    id: day,
    planId: 'p',
    name,
    status: 'completed',
    startedAt: `${day}T10:00:00`,
    finishedAt: `${day}T11:00:00`,
    notes: '',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const units = [unit('a', 'Push', 0), unit('b', 'Pull', 1)];

function cellFor(days: ReturnType<typeof buildPlanCalendarMonth>, date: string) {
  return days.find((d) => d.date === date)!;
}

describe('repeating-cycle calendar', () => {
  // Cycle: Push(0), Pull(1), Rest(2), anchored at 2026-07-01.
  const entries: ScheduleEntry[] = [
    entry({ position: 0, templateId: 'a' }),
    entry({ position: 1, templateId: 'b' }),
    entry({ position: 2, type: 'rest' }),
  ];

  it('places the cycle deterministically from the anchor date', () => {
    const days = buildPlanCalendarMonth({
      schedule: schedule({ startDate: '2026-07-01' }),
      entries,
      units,
      sessions: [],
      month: new Date('2026-07-15T12:00:00'),
      today: new Date('2026-07-01T12:00:00'),
    });
    expect(cellFor(days, '2026-07-01').label).toBe('Push');
    expect(cellFor(days, '2026-07-02').label).toBe('Pull');
    expect(cellFor(days, '2026-07-03').status).toBe('rest');
    expect(cellFor(days, '2026-07-04').label).toBe('Push'); // wraps
  });

  it('marks a past planned workout without a session as missed', () => {
    const days = buildPlanCalendarMonth({
      schedule: schedule({ startDate: '2026-07-01' }),
      entries,
      units,
      sessions: [],
      month: new Date('2026-07-10T12:00:00'),
      today: new Date('2026-07-10T12:00:00'),
    });
    expect(cellFor(days, '2026-07-01').status).toBe('missed');
    expect(cellFor(days, '2026-07-10').status).toBe('planned'); // today, Push
  });

  it('a completed session overrides the planned entry', () => {
    const days = buildPlanCalendarMonth({
      schedule: schedule({ startDate: '2026-07-01' }),
      entries,
      units,
      sessions: [session('2026-07-01')],
      month: new Date('2026-07-01T12:00:00'),
      today: new Date('2026-07-05T12:00:00'),
    });
    expect(cellFor(days, '2026-07-01').status).toBe('completed');
  });

  it('has no planned overlay before the anchor or without one', () => {
    const before = buildPlanCalendarMonth({
      schedule: schedule({ startDate: '2026-07-10' }),
      entries,
      units,
      sessions: [],
      month: new Date('2026-07-01T12:00:00'),
      today: new Date('2026-07-20T12:00:00'),
    });
    expect(cellFor(before, '2026-07-05').status).toBe('free');

    const noAnchor = buildPlanCalendarMonth({
      schedule: schedule({ startDate: undefined }),
      entries,
      units,
      sessions: [],
      month: new Date('2026-07-01T12:00:00'),
      today: new Date('2026-07-20T12:00:00'),
    });
    expect(cellFor(noAnchor, '2026-07-05').status).toBe('free');
  });
});

describe('weekly calendar', () => {
  // Mon: Push, Wed: Pull.
  const entries: ScheduleEntry[] = [
    {
      id: 'e0',
      scheduleId: 's',
      position: 0,
      weekday: 0,
      type: 'workout',
      templateId: 'a',
    },
    {
      id: 'e1',
      scheduleId: 's',
      position: 1,
      weekday: 2,
      type: 'workout',
      templateId: 'b',
    },
  ];

  it('maps units to weekdays and leaves the rest free', () => {
    const days = buildPlanCalendarMonth({
      schedule: schedule({ mode: 'weekly' }),
      entries,
      units,
      sessions: [],
      month: new Date('2026-07-15T12:00:00'),
      today: new Date('2026-07-01T12:00:00'),
    });
    // 2026-07-06 is a Monday, 2026-07-08 a Wednesday.
    expect(cellFor(days, '2026-07-06').label).toBe('Push');
    expect(cellFor(days, '2026-07-08').label).toBe('Pull');
    expect(cellFor(days, '2026-07-07').status).toBe('free'); // Tuesday
  });
});

describe('free-rotation calendar', () => {
  it('shows only actual sessions, never a planned overlay', () => {
    const days = buildPlanCalendarMonth({
      schedule: schedule({ mode: 'free-rotation' }),
      entries: [],
      units,
      sessions: [session('2026-07-09', 'Beine')],
      month: new Date('2026-07-01T12:00:00'),
      today: new Date('2026-07-20T12:00:00'),
    });
    expect(cellFor(days, '2026-07-09').status).toBe('completed');
    expect(cellFor(days, '2026-07-10').status).toBe('free');
  });
});
