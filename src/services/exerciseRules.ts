import type { TrackingType, WeightMode } from '@/types';

/**
 * Shared exercise business rules.
 *
 * The single source of truth for which weight conventions are valid for a
 * tracking type. Used by the exercise form and by the plan-package import, so
 * the two can never validate with different rules.
 */

/** Weight conventions that are valid for a tracking type. */
export function allowedWeightModes(trackingType: TrackingType): WeightMode[] {
  switch (trackingType) {
    case 'weight_reps':
      return ['total', 'per_hand'];
    case 'bodyweight_reps':
      return ['added_weight', 'none'];
    case 'assisted_bodyweight_reps':
      return ['assistance', 'none'];
    // Cardio never records a weight either: the mode is always `none`.
    case 'reps_only':
    case 'duration':
    case 'cardio':
      return ['none'];
  }
}

export function isWeightModeAllowed(
  trackingType: TrackingType,
  weightMode: WeightMode,
): boolean {
  return allowedWeightModes(trackingType).includes(weightMode);
}

/** The convention to assume when a tracking type is chosen or imported. */
export function defaultWeightModeFor(trackingType: TrackingType): WeightMode {
  switch (trackingType) {
    case 'weight_reps':
      return 'total';
    case 'bodyweight_reps':
      return 'added_weight';
    case 'assisted_bodyweight_reps':
      return 'assistance';
    case 'reps_only':
    case 'duration':
    case 'cardio':
      return 'none';
  }
}
