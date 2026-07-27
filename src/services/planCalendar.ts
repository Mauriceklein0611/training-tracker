import { differenceInCalendarDays, endOfMonth, parseISO, startOfMonth } from 'date-fns';
import type {
  PlanSchedule,
  PlanScheduleException,
  ScheduleEntry,
  WorkoutSession,
  WorkoutTemplate,
} from '@/types';
import { dayKey } from '@/utils/date';
import { weekdayIndexMon0, normalizeCursor } from '@/services/schedule';

/**
 * Pure plan calendar derivation (Phase 4).
 *
 * Planned days are derived from the schedule and the date, never pre-generated
 * and stored: a repeating cycle repeats deterministically from its anchor date,
 * a weekly plan maps weekdays, and free rotation is not date-bound so it shows
 * only what was actually trained. The actual layer comes from the plan's
 * completed sessions. Everything here is a pure function of its inputs and uses
 * local calendar days, so a timezone shift never moves a day.
 */

export type PlanCalendarStatus =
  /** A completed session of this plan happened that day. */
  | 'completed'
  /** A workout is planned for that day (today or future). */
  | 'planned'
  /** A planned workout in the past with no matching session. */
  | 'missed'
  /** A planned rest day. */
  | 'rest'
  /** A planned workout the user deliberately skipped (not counted as missed). */
  | 'skipped'
  /** Nothing planned and nothing done. */
  | 'free';

export interface PlanCalendarDay {
  /** Local day, `yyyy-MM-dd`. */
  date: string;
  /** Day of month, 1–31, for rendering. */
  dayOfMonth: number;
  /** 0 = Monday … 6 = Sunday. */
  weekday: number;
  status: PlanCalendarStatus;
  /** Name to show: the completed unit, the planned unit, or the rest label. */
  label?: string;
  /** True when the day is today (local). */
  isToday: boolean;
}

export interface PlanCalendarInput {
  schedule: PlanSchedule;
  entries: ScheduleEntry[];
  units: WorkoutTemplate[];
  /** Completed sessions attributed to the plan. */
  sessions: WorkoutSession[];
  /** Per-day overrides: a skipped workout or an extra rest day. */
  exceptions?: PlanScheduleException[];
  /** The month to build, any date within it. */
  month: Date;
  today?: Date;
  /**
   * Anchor for a repeating cycle's day-0. Falls back through
   * `schedule.startDate`; without an anchor a cycle has no planned overlay.
   */
  anchorDate?: string;
}

function sortByPosition(entries: ScheduleEntry[]): ScheduleEntry[] {
  return [...entries].sort((a, b) => a.position - b.position);
}

function unitName(
  templateId: string | undefined,
  unitsById: Map<string, WorkoutTemplate>,
): string {
  return (templateId && unitsById.get(templateId)?.name) || 'Entfernte Einheit';
}

/** The planned entry for a given local day, or undefined when nothing is planned. */
function plannedEntryFor(
  input: PlanCalendarInput,
  date: Date,
): { type: 'workout' | 'rest'; label: string } | undefined {
  const { schedule, entries } = input;
  const unitsById = new Map(input.units.map((unit) => [unit.id, unit]));

  if (schedule.mode === 'weekly') {
    const weekday = weekdayIndexMon0(date);
    const entry = entries.find((e) => (e.weekday ?? e.position) === weekday);
    if (!entry) return undefined; // unassigned weekday = free
    if (entry.type === 'rest')
      return { type: 'rest', label: entry.label?.trim() || 'Pause' };
    return { type: 'workout', label: unitName(entry.templateId, unitsById) };
  }

  if (schedule.mode === 'repeating-cycle') {
    const ordered = sortByPosition(entries);
    if (ordered.length === 0) return undefined;
    const anchor = input.anchorDate ?? schedule.startDate;
    if (!anchor) return undefined; // no anchor → cannot place the cycle on dates
    const offset = differenceInCalendarDays(date, parseISO(anchor));
    if (offset < 0) return undefined; // before the plan started
    const index = normalizeCursor(offset, ordered.length);
    const entry = ordered[index];
    if (entry.type === 'rest')
      return { type: 'rest', label: entry.label?.trim() || 'Pause' };
    return { type: 'workout', label: unitName(entry.templateId, unitsById) };
  }

  // free-rotation: not date-bound, so nothing is planned on a calendar day.
  return undefined;
}

/** Builds the calendar cells for the month containing `input.month`. */
export function buildPlanCalendarMonth(input: PlanCalendarInput): PlanCalendarDay[] {
  const today = input.today ?? new Date();
  const todayKey = dayKey(today);
  const first = startOfMonth(input.month);
  const last = endOfMonth(input.month);

  // Completed sessions by local day.
  const completedByDay = new Map<string, WorkoutSession>();
  for (const session of input.sessions) {
    const key = dayKey(session.finishedAt ?? session.startedAt);
    if (!completedByDay.has(key)) completedByDay.set(key, session);
  }

  // Per-day exceptions (at most one per day; a later one wins deterministically).
  const exceptionByDay = new Map<string, PlanScheduleException>();
  for (const exception of input.exceptions ?? []) {
    exceptionByDay.set(exception.date, exception);
  }

  const days: PlanCalendarDay[] = [];
  const total = differenceInCalendarDays(last, first) + 1;
  for (let i = 0; i < total; i += 1) {
    const date = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i);
    const key = dayKey(date);
    const weekday = weekdayIndexMon0(date);
    const isToday = key === todayKey;

    const done = completedByDay.get(key);
    if (done) {
      days.push({
        date: key,
        dayOfMonth: date.getDate(),
        weekday,
        status: 'completed',
        label: done.name,
        isToday,
      });
      continue;
    }

    const planned = plannedEntryFor(input, date);

    // A per-day exception overrides the derived plan, but never a completed day.
    const exception = exceptionByDay.get(key);
    if (exception) {
      if (exception.type === 'rest') {
        days.push({
          date: key,
          dayOfMonth: date.getDate(),
          weekday,
          status: 'rest',
          label: exception.note?.trim() || 'Pause',
          isToday,
        });
        continue;
      }
      // 'skip': the day's planned workout is cancelled — shown as skipped, not
      // missed. Keep the workout name so it is clear what was skipped.
      const skippedLabel =
        exception.note?.trim() ||
        (planned?.type === 'workout' ? planned.label : undefined) ||
        'Übersprungen';
      days.push({
        date: key,
        dayOfMonth: date.getDate(),
        weekday,
        status: 'skipped',
        label: skippedLabel,
        isToday,
      });
      continue;
    }
    if (!planned) {
      days.push({
        date: key,
        dayOfMonth: date.getDate(),
        weekday,
        status: 'free',
        isToday,
      });
      continue;
    }
    if (planned.type === 'rest') {
      days.push({
        date: key,
        dayOfMonth: date.getDate(),
        weekday,
        status: 'rest',
        label: planned.label,
        isToday,
      });
      continue;
    }
    // A planned workout: missed if it is in the past, otherwise upcoming.
    days.push({
      date: key,
      dayOfMonth: date.getDate(),
      weekday,
      status: key < todayKey ? 'missed' : 'planned',
      label: planned.label,
      isToday,
    });
  }
  return days;
}
