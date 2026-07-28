import type { AnalyticsDataset } from '@/services/analytics';
import { buildSetContexts, filterContextsByRange } from '@/services/analytics';
import { isCompleted, isWorkingSet } from '@/services/metrics';
import { regionForMuscle } from '@/features/muscles/muscleRegions';
import type { DateRange } from '@/utils/date';

/** One exercise's contribution to a body region within a range. */
export interface RegionExerciseUsage {
  exerciseName: string;
  /** Working sets performed for this exercise in the range. */
  sets: number;
  /** Distinct sessions the exercise was trained in. */
  sessions: number;
}

/**
 * For each body region, the exercises that trained it in the range with their
 * working-set count and training frequency. An exercise trains a region when its
 * primary or a secondary muscle maps there. Pure and derived from the dataset;
 * an exercise with no mapped muscle simply contributes to no region.
 */
export function buildRegionExerciseUsage(
  dataset: AnalyticsDataset,
  range: DateRange | null,
): Record<string, RegionExerciseUsage[]> {
  // Precompute each exercise's regions from its muscle groups.
  const regionsByExercise = new Map<string, Set<string>>();
  for (const exercise of dataset.exercises) {
    const regions = new Set<string>();
    for (const label of [
      exercise.primaryMuscleGroup,
      ...exercise.secondaryMuscleGroups,
    ]) {
      const region = label ? regionForMuscle(label) : undefined;
      if (region) regions.add(region);
    }
    if (regions.size > 0) regionsByExercise.set(exercise.id, regions);
  }

  // Accumulate per region → per exercise.
  const acc = new Map<
    string,
    Map<string, { name: string; sets: number; sessions: Set<string> }>
  >();
  const contexts = filterContextsByRange(buildSetContexts(dataset), range).filter(
    (context) => isCompleted(context.set) && isWorkingSet(context.set),
  );
  for (const context of contexts) {
    const regions = regionsByExercise.get(context.sessionExercise.exerciseId);
    if (!regions) continue;
    const name = context.sessionExercise.exerciseNameSnapshot;
    for (const region of regions) {
      const byExercise = acc.get(region) ?? new Map();
      const entry = byExercise.get(name) ?? {
        name,
        sets: 0,
        sessions: new Set<string>(),
      };
      entry.sets += 1;
      entry.sessions.add(context.session.id);
      byExercise.set(name, entry);
      acc.set(region, byExercise);
    }
  }

  const result: Record<string, RegionExerciseUsage[]> = {};
  for (const [region, byExercise] of acc) {
    result[region] = [...byExercise.values()]
      .map((entry) => ({
        exerciseName: entry.name,
        sets: entry.sets,
        sessions: entry.sessions.size,
      }))
      .sort(
        (a, b) => b.sets - a.sets || a.exerciseName.localeCompare(b.exerciseName, 'de'),
      );
  }
  return result;
}
