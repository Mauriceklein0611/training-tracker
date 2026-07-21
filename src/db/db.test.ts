import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { ensureSettings, MIGRATIONS, SCHEMA_VERSION, TrainingDatabase } from '@/db/db';

/**
 * Migration tests.
 *
 * Each case creates a database at an older schema version, writes data in that
 * old shape, then opens it with the current class and asserts that the upgrade
 * ran and that no data was lost — the property that matters most, because a
 * failed migration would mean losing a training history.
 */

const NAME = 'migration-test';

afterEach(async () => {
  await Dexie.delete(NAME);
});

/** Creates the database exactly as version 1 defined it. */
async function createVersion1Database(): Promise<Dexie> {
  const legacy = new Dexie(NAME);
  legacy.version(1).stores({
    exercises: 'id, name, primaryMuscleGroup, equipment, archived',
    workoutTemplates: 'id, name, updatedAt',
    templateExercises: 'id, templateId, exerciseId, [templateId+order]',
    workoutSessions: 'id, status, startedAt, templateId',
    sessionExercises: 'id, sessionId, exerciseId, [sessionId+order]',
    workoutSets: 'id, sessionExerciseId, [sessionExerciseId+position]',
    settings: 'id',
  });
  await legacy.open();
  return legacy;
}

describe('schema migrations', () => {
  it('documents every version that exists', () => {
    expect(MIGRATIONS.map((migration) => migration.version)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(MIGRATIONS[MIGRATIONS.length - 1].version).toBe(SCHEMA_VERSION);
  });

  it('upgrades a version 1 database to the current version', async () => {
    const legacy = await createVersion1Database();
    expect(legacy.verno).toBe(1);
    legacy.close();

    const upgraded = new TrainingDatabase(NAME);
    await upgraded.open();

    expect(upgraded.verno).toBe(SCHEMA_VERSION);
    upgraded.close();
  });

  it('keeps all existing records across the upgrade', async () => {
    const legacy = await createVersion1Database();
    await legacy.table('exercises').add({
      id: 'ex-1',
      name: 'Altes Bankdrücken',
      primaryMuscleGroup: 'Brust',
      equipment: 'Langhantel',
      trackingType: 'weight_reps',
      weightMode: 'total',
      defaultRestSeconds: 120,
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await legacy.table('workoutSessions').add({
      id: 'se-1',
      name: 'Altes Training',
      status: 'completed',
      startedAt: '2026-01-01T10:00:00.000Z',
      finishedAt: '2026-01-01T11:00:00.000Z',
      notes: '',
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-01T10:00:00.000Z',
    });
    legacy.close();

    const upgraded = new TrainingDatabase(NAME);
    await upgraded.open();

    expect(await upgraded.exercises.count()).toBe(1);
    expect(await upgraded.workoutSessions.count()).toBe(1);
    expect((await upgraded.exercises.get('ex-1'))?.name).toBe('Altes Bankdrücken');
    upgraded.close();
  });

  it('backfills fields that version 1 did not have', async () => {
    const legacy = await createVersion1Database();
    await legacy.table('exercises').add({
      id: 'ex-2',
      name: 'Ohne Multiplikator',
      primaryMuscleGroup: 'Rücken',
      equipment: 'Kurzhantel',
      trackingType: 'weight_reps',
      weightMode: 'per_hand',
      defaultRestSeconds: 90,
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      // weightMultiplier, archived and secondaryMuscleGroups are missing.
    });
    legacy.close();

    const upgraded = new TrainingDatabase(NAME);
    await upgraded.open();
    const exercise = await upgraded.exercises.get('ex-2');

    expect(exercise?.weightMultiplier).toBe(1);
    expect(exercise?.archived).toBe(false);
    expect(exercise?.secondaryMuscleGroups).toEqual([]);
    upgraded.close();
  });

  it('adds the body weight table introduced in version 2', async () => {
    const legacy = await createVersion1Database();
    legacy.close();

    const upgraded = new TrainingDatabase(NAME);
    await upgraded.open();

    await upgraded.bodyWeightEntries.add({
      id: 'bw-1',
      date: '2026-07-20',
      weightKg: 80,
      notes: '',
      createdAt: '2026-07-20T00:00:00.000Z',
      updatedAt: '2026-07-20T00:00:00.000Z',
    });
    expect(await upgraded.bodyWeightEntries.count()).toBe(1);
    upgraded.close();
  });

  it('records the current schema version in the settings during the upgrade', async () => {
    const legacy = await createVersion1Database();
    await legacy.table('settings').add({
      id: 'app-settings',
      unit: 'kg',
      defaultRestSeconds: 120,
      defaultAnalyticsRange: '30d',
      darkMode: 'dark',
      restSoundEnabled: true,
      restVibrationEnabled: true,
      backupReminderDays: 14,
      schemaVersion: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    legacy.close();

    const upgraded = new TrainingDatabase(NAME);
    await upgraded.open();

    expect((await upgraded.settings.get('app-settings'))?.schemaVersion).toBe(SCHEMA_VERSION);
    upgraded.close();
  });

  it('backfills the rest snapshot from the exercise default in version 4', async () => {
    const legacy = await createVersion1Database();
    await legacy.table('exercises').add({
      id: 'ex-1',
      name: 'Bankdrücken',
      primaryMuscleGroup: 'Brust',
      secondaryMuscleGroups: [],
      equipment: 'Langhantel',
      trackingType: 'weight_reps',
      weightMode: 'total',
      weightMultiplier: 1,
      defaultRestSeconds: 95,
      notes: '',
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    // A session exercise written before the snapshot existed.
    await legacy.table('sessionExercises').add({
      id: 'se-1',
      sessionId: 's-1',
      exerciseId: 'ex-1',
      order: 0,
      exerciseNameSnapshot: 'Bankdrücken',
      trackingTypeSnapshot: 'weight_reps',
      weightModeSnapshot: 'total',
      weightMultiplierSnapshot: 1,
      notes: '',
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-01T10:00:00.000Z',
    });
    legacy.close();

    const upgraded = new TrainingDatabase(NAME);
    await upgraded.open();
    const entry = await upgraded.sessionExercises.get('se-1');

    expect(entry?.restSecondsSnapshot).toBe(95);
    // Cannot be reconstructed, and its absence means "no set goal" as before.
    expect(entry?.targetSetsSnapshot).toBeUndefined();
    // Nothing else was touched.
    expect(entry?.exerciseNameSnapshot).toBe('Bankdrücken');
    expect(await upgraded.sessionExercises.count()).toBe(1);
    upgraded.close();
  });

  it('falls back to the global default when the exercise is gone', async () => {
    const legacy = await createVersion1Database();
    await legacy.table('settings').add({
      id: 'app-settings',
      unit: 'kg',
      defaultRestSeconds: 175,
      defaultAnalyticsRange: '30d',
      darkMode: 'dark',
      restSoundEnabled: true,
      restVibrationEnabled: true,
      backupReminderDays: 14,
      schemaVersion: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await legacy.table('sessionExercises').add({
      id: 'se-orphan',
      sessionId: 's-1',
      exerciseId: 'deleted-exercise',
      order: 0,
      exerciseNameSnapshot: 'Gelöschte Übung',
      trackingTypeSnapshot: 'weight_reps',
      weightModeSnapshot: 'total',
      weightMultiplierSnapshot: 1,
      notes: '',
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-01T10:00:00.000Z',
    });
    legacy.close();

    const upgraded = new TrainingDatabase(NAME);
    await upgraded.open();

    expect((await upgraded.sessionExercises.get('se-orphan'))?.restSecondsSnapshot).toBe(175);
    upgraded.close();
  });

  it('keeps weight-only body entries valid after the version 3 upgrade', async () => {
    const legacy = await createVersion1Database();
    legacy.close();

    // Written while the app was at version 2: weight only, no measurements.
    const v2 = new TrainingDatabase(NAME);
    await v2.open();
    await v2.bodyWeightEntries.add({
      id: 'bw-old',
      date: '2026-07-01',
      weightKg: 82,
      notes: 'morgens',
      createdAt: '2026-07-01T06:00:00.000Z',
      updatedAt: '2026-07-01T06:00:00.000Z',
    });
    v2.close();

    const upgraded = new TrainingDatabase(NAME);
    await upgraded.open();
    const entry = await upgraded.bodyWeightEntries.get('bw-old');

    expect(entry?.weightKg).toBe(82);
    // The new fields are simply absent — nothing was invented for them.
    expect(entry?.bodyFatPercent).toBeUndefined();
    expect(entry?.measurements).toBeUndefined();
    upgraded.close();
  });
});

describe('ensureSettings', () => {
  it('creates the settings singleton on first launch', async () => {
    const database = new TrainingDatabase(NAME);
    await database.open();

    const settings = await ensureSettings(database);
    expect(settings.id).toBe('app-settings');
    expect(settings.unit).toBe('kg');
    expect(settings.schemaVersion).toBe(SCHEMA_VERSION);
    database.close();
  });

  it('is idempotent', async () => {
    const database = new TrainingDatabase(NAME);
    await database.open();

    const first = await ensureSettings(database);
    const second = await ensureSettings(database);

    expect(second.createdAt).toBe(first.createdAt);
    expect(await database.settings.count()).toBe(1);
    database.close();
  });
});
