import { db } from '@/db/db';
import type { AnalyticsDataset } from '@/services/analytics';

/**
 * Loads the tables the analytics engine works on.
 *
 * Reading the four tables once and joining them in memory is considerably
 * faster than issuing one IndexedDB query per session, and the data volume of a
 * personal training log stays small enough to hold in memory comfortably.
 */
export async function loadAnalyticsDataset(): Promise<AnalyticsDataset> {
  const [sessions, sessionExercises, sets, exercises, bodyWeightEntries] =
    await Promise.all([
      db.workoutSessions.toArray(),
      db.sessionExercises.toArray(),
      db.workoutSets.toArray(),
      db.exercises.toArray(),
      db.bodyWeightEntries.toArray(),
    ]);
  return { sessions, sessionExercises, sets, exercises, bodyWeightEntries };
}
