import type { ExerciseTargetValues } from '@/features/templates/ExerciseTargetFields';
import type { TrackingType } from '@/types';

/**
 * Labels for {@link summarizeExerciseTargets}. Passed in rather than translated
 * here so the function stays pure and language-independent — the same rule the
 * export services follow.
 */
export interface TargetSummaryLabels {
  sets: (value: number) => string;
  intervals: (value: number) => string;
  reps: (min: number, max: number) => string;
  repsFrom: (min: number) => string;
  repsTo: (max: number) => string;
  duration: (seconds: number) => string;
  distance: (meters: number) => string;
  rpe: (value: number) => string;
  rest: (seconds: number) => string;
  /** Used for a deliberate rest of 0 s, which is a setting, not a missing value. */
  noRest: () => string;
}

/**
 * One-line summary of an exercise's plan targets, shown while the row is
 * collapsed (#44).
 *
 * Only values that are actually set are mentioned: an absent rep range is left
 * out instead of being displayed as a guessed default, and a deliberate rest of
 * 0 s is reported as "no rest" rather than silently dropped.
 */
export function summarizeExerciseTargets(
  values: Pick<
    ExerciseTargetValues,
    | 'targetSets'
    | 'restSeconds'
    | 'targetRepMin'
    | 'targetRepMax'
    | 'targetDurationSeconds'
    | 'targetDistanceMeters'
    | 'targetRpe'
  >,
  trackingType: TrackingType,
  labels: TargetSummaryLabels,
): string {
  const isCardio = trackingType === 'cardio';
  const parts: string[] = [];

  if (values.targetSets > 0) {
    parts.push(
      isCardio ? labels.intervals(values.targetSets) : labels.sets(values.targetSets),
    );
  }

  if (isCardio || trackingType === 'duration') {
    if (values.targetDurationSeconds) {
      parts.push(labels.duration(values.targetDurationSeconds));
    }
  } else if (values.targetRepMin != null && values.targetRepMax != null) {
    parts.push(labels.reps(values.targetRepMin, values.targetRepMax));
  } else if (values.targetRepMin != null) {
    parts.push(labels.repsFrom(values.targetRepMin));
  } else if (values.targetRepMax != null) {
    parts.push(labels.repsTo(values.targetRepMax));
  }

  if (isCardio) {
    if (values.targetDistanceMeters) {
      parts.push(labels.distance(values.targetDistanceMeters));
    }
    if (values.targetRpe) parts.push(labels.rpe(values.targetRpe));
  }

  parts.push(values.restSeconds > 0 ? labels.rest(values.restSeconds) : labels.noRest());

  return parts.join(' · ');
}
