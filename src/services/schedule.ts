import type {
  PlanSchedule,
  ScheduleEntry,
  ScheduleEntryType,
  ScheduleMode,
  WorkoutTemplate,
} from '@/types';

/**
 * Pure scheduling logic.
 *
 * A {@link PlanSchedule} lays a plan's reusable workout units out over time in
 * one of three modes. This module resolves, for any given moment, which day is
 * current, which workout to suggest starting next, and a short preview of what
 * follows — without touching the database. The repository owns persistence and
 * the mutable cursor; everything here is a pure function so it can be unit
 * tested against fixed inputs.
 */

export const SCHEDULE_MODE_LABELS: Record<ScheduleMode, string> = {
  'free-rotation': 'Freie Rotation',
  'repeating-cycle': 'Wiederholender Zyklus',
  weekly: 'Wochenplan',
};

export const SCHEDULE_MODE_DESCRIPTIONS: Record<ScheduleMode, string> = {
  'free-rotation':
    'Die Übungseinheiten werden der Reihe nach vorgeschlagen. Pausentage ' +
    'entstehen einfach dadurch, dass du an einem Tag nicht trainierst.',
  'repeating-cycle':
    'Ein fester Ablauf aus Trainings- und Pausentagen, der sich nach dem ' +
    'letzten Tag wiederholt (z. B. Push, Pull, Pause, Beine, Pause).',
  weekly:
    'Feste Zuordnung von Übungseinheiten zu Wochentagen. Nicht belegte Tage ' +
    'bleiben frei.',
};

/** Weekday labels, index 0 = Monday, to match {@link weekdayIndexMon0}. */
export const WEEKDAY_LABELS = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
] as const;

export const WEEKDAY_LABELS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

/** Weekday as 0 (Monday) – 6 (Sunday), independent of the JS Sunday-first order. */
export function weekdayIndexMon0(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** A schedule entry resolved against the plan's current workout units. */
export interface ResolvedScheduleEntry {
  entry: ScheduleEntry;
  type: ScheduleEntryType;
  /** The unit for a workout entry, if it still exists; undefined for rest. */
  template?: WorkoutTemplate;
  /** Display name: the unit name, the rest label, or a sensible fallback. */
  name: string;
}

/** The scheduling state at one moment: what is now, what to start, what follows. */
export interface ScheduleState {
  mode: ScheduleMode;
  /** The day considered "current" (today's weekday, or the cursor position). */
  current?: ResolvedScheduleEntry;
  /** The next workout to actually start, skipping rest and deleted units. */
  nextWorkout?: ResolvedScheduleEntry;
  /** A short preview of the coming days for visualisation. */
  upcoming: ResolvedScheduleEntry[];
}

const DEFAULT_REST_LABEL = 'Pause';

function resolve(
  entry: ScheduleEntry,
  unitsById: Map<string, WorkoutTemplate>,
): ResolvedScheduleEntry {
  if (entry.type === 'rest') {
    return { entry, type: 'rest', name: entry.label?.trim() || DEFAULT_REST_LABEL };
  }
  const template = entry.templateId ? unitsById.get(entry.templateId) : undefined;
  return {
    entry,
    type: 'workout',
    template,
    name: template?.name ?? entry.label?.trim() ?? 'Entfernte Einheit',
  };
}

function sortByPosition(entries: ScheduleEntry[]): ScheduleEntry[] {
  return [...entries].sort((a, b) => a.position - b.position);
}

/** Normalises a possibly out-of-range cursor into a valid index. */
export function normalizeCursor(
  cyclePosition: number | undefined,
  length: number,
): number {
  if (length <= 0) return 0;
  const raw = cyclePosition ?? 0;
  return ((raw % length) + length) % length;
}

// ---- free rotation ----------------------------------------------------

/**
 * Index of the workout to suggest after the last completed one. Mirrors the
 * historical rotation: the day after the last trained unit, wrapping around.
 * When the trained unit is gone, it resumes at whatever now holds its former
 * position (the pre-schedule fallback); with nothing completed it is the first.
 */
function freeRotationNextIndex(
  entries: ScheduleEntry[],
  lastCompletedTemplateId: string | undefined,
  lastCompletedPosition: number | undefined,
): number {
  if (entries.length === 0) return -1;
  if (!lastCompletedTemplateId) return 0;
  const index = entries.findIndex((e) => e.templateId === lastCompletedTemplateId);
  if (index >= 0) return (index + 1) % entries.length;
  if (lastCompletedPosition != null) {
    return Math.min(Math.max(lastCompletedPosition, 0), entries.length - 1);
  }
  return 0;
}

function freeRotationState(
  entries: ScheduleEntry[],
  unitsById: Map<string, WorkoutTemplate>,
  lastCompletedTemplateId: string | undefined,
  lastCompletedPosition: number | undefined,
  previewCount: number,
): ScheduleState {
  const workouts = sortByPosition(entries).filter((e) => e.type === 'workout');
  if (workouts.length === 0) {
    return { mode: 'free-rotation', upcoming: [] };
  }
  const start = freeRotationNextIndex(
    workouts,
    lastCompletedTemplateId,
    lastCompletedPosition,
  );
  const upcoming: ResolvedScheduleEntry[] = [];
  for (let i = 0; i < Math.min(previewCount, workouts.length); i += 1) {
    upcoming.push(resolve(workouts[(start + i) % workouts.length], unitsById));
  }
  // Suggest the first upcoming entry whose unit still exists.
  const nextWorkout = upcoming.find((r) => r.template) ?? upcoming[0];
  return { mode: 'free-rotation', current: upcoming[0], nextWorkout, upcoming };
}

// ---- repeating cycle --------------------------------------------------

function cycleState(
  schedule: PlanSchedule,
  entries: ScheduleEntry[],
  unitsById: Map<string, WorkoutTemplate>,
  previewCount: number,
): ScheduleState {
  const ordered = sortByPosition(entries);
  if (ordered.length === 0) {
    return { mode: 'repeating-cycle', upcoming: [] };
  }
  const cursor = normalizeCursor(schedule.cyclePosition, ordered.length);
  const upcoming: ResolvedScheduleEntry[] = [];
  for (let i = 0; i < Math.min(previewCount, ordered.length); i += 1) {
    upcoming.push(resolve(ordered[(cursor + i) % ordered.length], unitsById));
  }
  const current = resolve(ordered[cursor], unitsById);
  // The next actual workout: scan the whole cycle from the cursor.
  let nextWorkout: ResolvedScheduleEntry | undefined;
  for (let i = 0; i < ordered.length; i += 1) {
    const candidate = resolve(ordered[(cursor + i) % ordered.length], unitsById);
    if (candidate.type === 'workout' && candidate.template) {
      nextWorkout = candidate;
      break;
    }
  }
  return { mode: 'repeating-cycle', current, nextWorkout, upcoming };
}

// ---- weekly -----------------------------------------------------------

function weeklyState(
  entries: ScheduleEntry[],
  unitsById: Map<string, WorkoutTemplate>,
  today: Date,
  previewCount: number,
): ScheduleState {
  const byWeekday = new Map<number, ScheduleEntry>();
  for (const entry of entries) {
    const weekday = entry.weekday ?? entry.position;
    if (weekday >= 0 && weekday <= 6) byWeekday.set(weekday, entry);
  }
  const todayIndex = weekdayIndexMon0(today);

  const upcoming: ResolvedScheduleEntry[] = [];
  for (let i = 0; i < previewCount; i += 1) {
    const weekday = (todayIndex + i) % 7;
    const entry = byWeekday.get(weekday);
    if (entry) {
      upcoming.push(resolve(entry, unitsById));
    } else {
      // An unassigned weekday is a free day; surface it as a rest-like preview.
      upcoming.push({
        entry: {
          id: `weekday-${weekday}`,
          scheduleId: '',
          position: weekday,
          type: 'rest',
          weekday,
        },
        type: 'rest',
        name: 'Frei',
      });
    }
  }

  const current = upcoming[0];
  let nextWorkout: ResolvedScheduleEntry | undefined;
  for (let i = 0; i < 7; i += 1) {
    const weekday = (todayIndex + i) % 7;
    const entry = byWeekday.get(weekday);
    if (entry && entry.type === 'workout') {
      const resolved = resolve(entry, unitsById);
      if (resolved.template) {
        nextWorkout = resolved;
        break;
      }
    }
  }
  return { mode: 'weekly', current, nextWorkout, upcoming };
}

// ---- public entry point -----------------------------------------------

export interface ScheduleStateInput {
  schedule: PlanSchedule;
  entries: ScheduleEntry[];
  units: WorkoutTemplate[];
  /** Template id of the most recently completed session of this plan, if any. */
  lastCompletedTemplateId?: string;
  /** The completed session's day position, used to resume a deleted unit. */
  lastCompletedPosition?: number;
  today?: Date;
  /** How many days of preview to build. */
  previewCount?: number;
}

/**
 * Resolves the current scheduling state for a plan. This is the single place the
 * app asks "what is today and what comes next"; the mode decides how the answer
 * is derived (completed sessions, an explicit cursor, or the weekday).
 */
export function resolveScheduleState(input: ScheduleStateInput): ScheduleState {
  const {
    schedule,
    entries,
    units,
    lastCompletedTemplateId,
    lastCompletedPosition,
    today = new Date(),
    previewCount = 7,
  } = input;
  const unitsById = new Map(units.map((unit) => [unit.id, unit]));

  switch (schedule.mode) {
    case 'repeating-cycle':
      return cycleState(schedule, entries, unitsById, previewCount);
    case 'weekly':
      return weeklyState(entries, unitsById, today, previewCount);
    case 'free-rotation':
    default:
      return freeRotationState(
        entries,
        unitsById,
        lastCompletedTemplateId,
        lastCompletedPosition,
        previewCount,
      );
  }
}

/**
 * The cursor value after stepping forward one day in a repeating cycle. Used
 * when a cycle day is skipped or a rest/rest-like day is marked done.
 */
export function advanceCursor(schedule: PlanSchedule, entryCount: number): number {
  return normalizeCursor((schedule.cyclePosition ?? 0) + 1, entryCount);
}

/**
 * The cursor value after a workout day of a repeating cycle was completed: one
 * past the first workout entry — at or after the current cursor — that matches
 * the completed unit. Scanning from the cursor mirrors how {@link cycleState}
 * resolves `nextWorkout`, so completing the suggested workout lands the cursor
 * exactly on the following day, even across intervening rest days.
 *
 * The cursor is returned unchanged when the cycle is empty or the completed unit
 * is not part of it, so an off-cycle or ad-hoc workout never mis-advances the
 * rotation.
 */
export function cursorAfterCompletedWorkout(
  schedule: PlanSchedule,
  entries: ScheduleEntry[],
  completedTemplateId: string | undefined,
): number {
  const ordered = sortByPosition(entries);
  const length = ordered.length;
  const cursor = normalizeCursor(schedule.cyclePosition, length);
  if (length === 0 || !completedTemplateId) return cursor;
  for (let offset = 0; offset < length; offset += 1) {
    const index = (cursor + offset) % length;
    const entry = ordered[index];
    if (entry.type === 'workout' && entry.templateId === completedTemplateId) {
      return normalizeCursor(index + 1, length);
    }
  }
  return cursor;
}
