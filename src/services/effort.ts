/**
 * Effort metrics — RPE and RIR — and the *approximate* mapping between them.
 *
 * RPE (rate of perceived exertion) is how hard a set felt (1–10). RIR (reps in
 * reserve) is how many more reps could have been done. Only the value the user
 * actually entered is ever stored as raw truth (see {@link WorkoutSet.rpe} /
 * {@link WorkoutSet.rir}); the other is derived here and must always be shown as
 * an approximation, never a second measured value.
 *
 * The mapping is the common subjective one:
 *   RPE 10 → 0 RIR · RPE 9 → 1 · RPE 8 → 2 · RPE 7 → 3 · RPE 6 → 4
 */

import { localeTag } from '@/i18n';

/** Suggested RPE chips: whole and half steps in the useful 6–10 band. */
export const RPE_CHIP_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;
/** Suggested RIR chips; the last is shown as "4+". */
export const RIR_CHIP_VALUES = [0, 1, 2, 3, 4] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Approximate RIR for a given RPE. Clamped to 0–10 and rounded to a half rep;
 * this is a subjective correspondence, not a measurement.
 */
export function approxRirFromRpe(rpe: number): number {
  return clamp(Math.round((10 - rpe) * 2) / 2, 0, 10);
}

/**
 * Approximate RPE for a given RIR. Clamped to the 1–10 RPE scale; subjective,
 * not a measurement.
 */
export function approxRpeFromRir(rir: number): number {
  return clamp(Math.round((10 - rir) * 2) / 2, 1, 10);
}

/** Trims a half-step number and follows the selected display locale. */
export function formatEffort(value: number): string {
  return value.toLocaleString(localeTag(), { maximumFractionDigits: 1 });
}
