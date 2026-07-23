import type { DeloadIntensity, TemplateVersionSnapshot } from '@/types';

export type { DeloadIntensity };

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
