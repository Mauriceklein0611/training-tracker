import { db, ensureSettings } from '@/db/db';
import { clearTransientAppState } from '@/services/appState';

/**
 * Destructive maintenance actions.
 *
 * Both operations are irreversible and only ever run behind an explicit user
 * confirmation in the UI. They are transactional, so a failure leaves the
 * database in its previous, consistent state rather than half-wiped.
 */

/**
 * Deletes the training history — sessions, their exercises and sets (including
 * any active workout draft). Exercises, plans, body data, settings, equipment
 * profiles, plan versions and AI analyses are kept.
 */
export async function deleteTrainingHistory(): Promise<void> {
  await db.transaction(
    'rw',
    db.workoutSessions,
    db.sessionExercises,
    db.workoutSets,
    async () => {
      await Promise.all([
        db.workoutSessions.clear(),
        db.sessionExercises.clear(),
        db.workoutSets.clear(),
      ]);
    },
  );
  // A running exercise timer belongs to a session that no longer exists.
  clearTransientAppState('timers');
}

/** Every table that holds user data — the full reset clears all of them. */
const ALL_DATA_TABLES = [
  'exercises',
  'workoutTemplates',
  'templateExercises',
  'templateVersions',
  'workoutSessions',
  'sessionExercises',
  'workoutSets',
  'bodyWeightEntries',
  'aiAnalyses',
  'aiExports',
  'equipmentProfiles',
  'settings',
] as const;

/**
 * Wipes all local data and restores the app to a fresh state: every table is
 * cleared and a default settings row is recreated, so the app comes up exactly
 * as it would after a first install.
 */
export async function resetAllData(): Promise<void> {
  await db.transaction(
    'rw',
    ALL_DATA_TABLES.map((name) => db.table(name)),
    async () => {
      await Promise.all(ALL_DATA_TABLES.map((name) => db.table(name).clear()));
    },
  );
  // Drop transient state kept outside the database (timer, theme) too.
  clearTransientAppState('all');
  // Recreate the settings singleton with fresh defaults.
  await ensureSettings();
}
