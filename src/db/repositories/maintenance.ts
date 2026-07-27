import { db, ensureSettings } from '@/db/db';
import { clearTransientAppState } from '@/services/appState';
import { seedSystemExercises } from '@/services/exerciseSeed';

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

/**
 * Every table that holds user data — the full reset clears all of them.
 *
 * This must list every store the database defines (`settings` included, it is
 * recreated with defaults afterwards). A guard test in `maintenance.test.ts`
 * asserts `db.tables` and this array stay in sync, so a newly added store is
 * never silently forgotten by the reset (as `planSchedules`/`scheduleEntries`
 * once were).
 */
export const ALL_DATA_TABLES = [
  'exercises',
  'trainingPlans',
  'workoutTemplates',
  'templateExercises',
  'templateVersions',
  'workoutSessions',
  'sessionExercises',
  'workoutSets',
  'bodyWeightEntries',
  'aiAnalyses',
  'aiExports',
  'planImports',
  'equipmentProfiles',
  'planSchedules',
  'scheduleEntries',
  'workoutUnitTemplates',
  'workoutUnitTemplateExercises',
  'planUsagePeriods',
  'planDeloadPeriods',
  'planScheduleExceptions',
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
  // Recreate the settings singleton with fresh defaults and re-seed the curated
  // system exercise catalog, so a reset lands on the same state as a fresh
  // install rather than an empty exercise list.
  await ensureSettings();
  await seedSystemExercises();
}
