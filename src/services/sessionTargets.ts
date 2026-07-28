import type { SessionExercise } from '@/types';

/** Plan targets shown for an exercise in the live view. */
export interface EffectiveTarget {
  targetSets?: number;
  targetRepMin?: number;
  targetRepMax?: number;
  targetDurationSeconds?: number;
  targetDistanceMeters?: number;
  targetRpe?: number;
  restSeconds?: number;
}

type TargetSnapshotFields = Pick<
  SessionExercise,
  | 'templateExerciseIdSnapshot'
  | 'targetSetsSnapshot'
  | 'targetRepMinSnapshot'
  | 'targetRepMaxSnapshot'
  | 'targetDurationSecondsSnapshot'
  | 'targetDistanceMetersSnapshot'
  | 'targetRpeSnapshot'
  | 'restSecondsSnapshot'
>;

/**
 * Resolves the targets to show for a running exercise.
 *
 * `templateExerciseIdSnapshot` marks a workout started under schema v15+, where
 * the full target set (sets, rep range, duration) was frozen per position —
 * those snapshots are authoritative and the ambiguous by-exercise plan lookup is
 * ignored (so the same exercise at two positions keeps its own targets, and a
 * later plan edit changes nothing).
 *
 * Older active workouts (schema v14) only carry `targetSetsSnapshot`, which
 * predates v15. Their rep and duration targets are therefore merged field-wise
 * from the plan lookup, giving those sessions a compatible fallback instead of
 * silently dropping the rep range and duration.
 */
export function resolveEffectiveTarget(
  sessionExercise: TargetSnapshotFields,
  planTarget: EffectiveTarget | undefined,
): EffectiveTarget | undefined {
  if (sessionExercise.templateExerciseIdSnapshot != null) {
    return {
      targetSets: sessionExercise.targetSetsSnapshot,
      targetRepMin: sessionExercise.targetRepMinSnapshot,
      targetRepMax: sessionExercise.targetRepMaxSnapshot,
      targetDurationSeconds: sessionExercise.targetDurationSecondsSnapshot,
      targetDistanceMeters: sessionExercise.targetDistanceMetersSnapshot,
      targetRpe: sessionExercise.targetRpeSnapshot,
      restSeconds: sessionExercise.restSecondsSnapshot,
    };
  }

  if (sessionExercise.targetSetsSnapshot == null && planTarget == null) return planTarget;

  return {
    targetSets: sessionExercise.targetSetsSnapshot ?? planTarget?.targetSets,
    targetRepMin: planTarget?.targetRepMin,
    targetRepMax: planTarget?.targetRepMax,
    targetDurationSeconds: planTarget?.targetDurationSeconds,
    // Cardio targets come from the per-position snapshot; the legacy plan lookup
    // (v14 sessions) never carried them, so they fall back field-wise.
    targetDistanceMeters:
      sessionExercise.targetDistanceMetersSnapshot ?? planTarget?.targetDistanceMeters,
    targetRpe: sessionExercise.targetRpeSnapshot ?? planTarget?.targetRpe,
    restSeconds: sessionExercise.restSecondsSnapshot ?? planTarget?.restSeconds,
  };
}
