import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { DeloadIntensity, PlanDeloadPeriod, TemplateVersionSnapshot } from '@/types';
import { dayKey } from '@/utils/date';

export type { DeloadIntensity };

/** A deload lasts exactly this many local calendar days, including the start day. */
export const DELOAD_DURATION_DAYS = 7;

/** Concrete reductions applied while a deload is active, snapshotted per period. */
export interface DeloadSettings {
  /** Share by which target working sets are reduced (0..1). */
  setReductionPercent: number;
  /** Share by which time-based targets are reduced (0..1). */
  durationReductionPercent: number;
  /** Added target reps-in-reserve (train easier). */
  addedRir: number;
}

/** Sensible defaults per intensity; snapshotted at start so later tweaks never
 * reinterpret a past deload. */
export const DELOAD_DEFAULTS: Record<DeloadIntensity, DeloadSettings> = {
  light: { setReductionPercent: 0.3, durationReductionPercent: 0.2, addedRir: 1 },
  medium: { setReductionPercent: 0.4, durationReductionPercent: 0.3, addedRir: 2 },
  strong: { setReductionPercent: 0.5, durationReductionPercent: 0.4, addedRir: 3 },
};

/**
 * Deload calculation.
 *
 * A deload week temporarily lowers training volume. Here that means reducing the
 * target working sets of every exercise in a plan by a chosen share, floored at
 * one set so no exercise disappears. Pure and testable; applying it to the live
 * plan (with a restore point) lives in the repository.
 */

export const DELOAD_PERCENT: Record<DeloadIntensity, number> = {
  light: 0.3,
  medium: 0.4,
  strong: 0.5,
};

export const DELOAD_INTENSITY_LABELS: Record<DeloadIntensity, string> = {
  light: 'Leicht (−30 %)',
  medium: 'Mittel (−40 %)',
  strong: 'Stark (−50 %)',
};

/** Reduced target sets for a deload, never below one. */
export function deloadSets(sets: number, percent: number): number {
  return Math.max(1, Math.round(sets * (1 - percent)));
}

/** Reduced time-based target for a deload, never below one second. */
export function deloadDuration(seconds: number, percent: number): number {
  return Math.max(1, Math.round(seconds * (1 - percent)));
}

/** The inclusive local end day of a deload starting on `startDate`. */
export function deloadEndDate(startDate: string): string {
  const start = parseISO(startDate);
  const end = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + (DELOAD_DURATION_DAYS - 1),
  );
  return dayKey(end);
}

/** Whether a deload period covers the given local day (inclusive). */
export function isDeloadActiveOn(period: PlanDeloadPeriod, today: Date): boolean {
  const key = dayKey(today);
  return key >= period.startDate && key <= period.endDate;
}

/** Remaining deload days including today, or 0 once it has ended. */
export function deloadRemainingDays(period: PlanDeloadPeriod, today: Date): number {
  if (!isDeloadActiveOn(period, today)) return 0;
  return differenceInCalendarDays(parseISO(period.endDate), today) + 1;
}

/** A copy of the snapshot with every exercise's target sets reduced. */
export function applyDeloadToSnapshot(
  snapshot: TemplateVersionSnapshot,
  percent: number,
): TemplateVersionSnapshot {
  return {
    ...snapshot,
    exercises: snapshot.exercises.map((exercise) => ({
      ...exercise,
      targetSets: deloadSets(exercise.targetSets, percent),
    })),
  };
}
