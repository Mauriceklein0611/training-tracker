import { beforeEach, describe, expect, it } from 'vitest';
import { db, SCHEMA_VERSION } from '@/db/db';
import {
  BACKUP_FORMAT_VERSION,
  backupFileName,
  createBackup,
  importBackup,
  parseBackupFile,
  validateBackupJson,
} from '@/services/backup';
import { createExercise } from '@/db/repositories/exercises';
import { upsertBodyWeightEntry } from '@/db/repositories/bodyWeight';
import {
  addSet,
  addExerciseToSession,
  completeSet,
  finishSession,
  startFreeSession,
} from '@/db/repositories/sessions';
import { resetDatabase } from '@/tests/dbTestUtils';

/** Seeds a small but complete database: one exercise, one finished session. */
async function seedDatabase() {
  const exercise = await createExercise({
    name: 'Bankdrücken',
    primaryMuscleGroup: 'Brust',
    secondaryMuscleGroups: ['Trizeps'],
    equipment: 'Langhantel',
    trackingType: 'weight_reps',
    weightMode: 'total',
    weightMultiplier: 1,
    defaultRestSeconds: 120,
    notes: '',
  });

  const session = await startFreeSession('Testtraining');
  const sessionExercise = await addExerciseToSession(session.id, exercise);
  const set = await addSet(sessionExercise.id, { restTargetSeconds: 120 });
  await completeSet(set.id, { weightKg: 80, reps: 8 });
  await finishSession(session.id);
  await upsertBodyWeightEntry({ date: '2026-07-20', weightKg: 80 });

  return { exercise, session };
}

beforeEach(async () => {
  await resetDatabase();
});

describe('createBackup', () => {
  it('exports every table with format and schema version', async () => {
    await seedDatabase();
    const backup = await createBackup();

    expect(backup.exportFormatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(backup.schemaVersion).toBe(SCHEMA_VERSION);
    expect(backup.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(backup.exercises).toHaveLength(1);
    expect(backup.workoutSessions).toHaveLength(1);
    expect(backup.sessionExercises).toHaveLength(1);
    expect(backup.workoutSets).toHaveLength(1);
    expect(backup.bodyWeightEntries).toHaveLength(1);
    expect(backup.settings).not.toBeNull();
  });

  it('exports an empty but valid file for a fresh database', async () => {
    const backup = await createBackup();
    expect(backup.exercises).toEqual([]);
    expect(validateBackupJson(JSON.parse(JSON.stringify(backup))).ok).toBe(true);
  });

  it('names the file with the export date', () => {
    expect(backupFileName(new Date('2026-07-21T09:00:00Z'))).toBe(
      'training-backup-2026-07-21.json',
    );
  });
});

describe('validateBackupJson', () => {
  it('accepts a file produced by createBackup', async () => {
    await seedDatabase();
    const raw = JSON.parse(JSON.stringify(await createBackup()));
    const result = validateBackupJson(raw);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.counts.exercises).toBe(1);
      expect(result.counts.workoutSets).toBe(1);
      expect(result.warnings).toEqual([]);
    }
  });

  it('rejects a file that is not a backup', () => {
    const result = validateBackupJson({ hello: 'world' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects invalid JSON with a readable message', () => {
    const result = parseBackupFile('{ this is not json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain('JSON');
  });

  it('rejects a newer export format instead of guessing', async () => {
    const raw = JSON.parse(JSON.stringify(await createBackup()));
    raw.exportFormatVersion = BACKUP_FORMAT_VERSION + 1;

    const result = validateBackupJson(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain('neueren Exportformat');
  });

  it('rejects structurally broken records', async () => {
    const raw = JSON.parse(JSON.stringify(await createBackup()));
    raw.exercises = [{ id: 'x', name: '' }];

    expect(validateBackupJson(raw).ok).toBe(false);
  });

  it('warns about sets that reference missing parents', async () => {
    await seedDatabase();
    const raw = JSON.parse(JSON.stringify(await createBackup()));
    raw.workoutSets[0].sessionExerciseId = 'missing';

    const result = validateBackupJson(raw);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings.join(' ')).toContain('Sätze');
  });

  it('warns when a file contains several active sessions', async () => {
    const raw = JSON.parse(JSON.stringify(await createBackup()));
    const base = {
      name: 'X',
      status: 'active',
      startedAt: '2026-07-01T10:00:00.000Z',
      notes: '',
      createdAt: '2026-07-01T10:00:00.000Z',
      updatedAt: '2026-07-01T10:00:00.000Z',
    };
    raw.workoutSessions = [
      { ...base, id: 'a' },
      { ...base, id: 'b', startedAt: '2026-07-02T10:00:00.000Z' },
    ];

    const result = validateBackupJson(raw);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings.join(' ')).toContain('aktive');
  });
});

describe('importBackup — replace', () => {
  it('restores a backup one to one into an empty database', async () => {
    await seedDatabase();
    const backup = await createBackup();

    await resetDatabase();
    expect(await db.exercises.count()).toBe(0);

    await importBackup(backup, 'replace');

    expect(await db.exercises.count()).toBe(1);
    expect(await db.workoutSessions.count()).toBe(1);
    expect(await db.workoutSets.count()).toBe(1);
    expect(await db.bodyWeightEntries.count()).toBe(1);

    const set = await db.workoutSets.toCollection().first();
    expect(set?.weightKg).toBe(80);
    expect(set?.reps).toBe(8);
  });

  it('discards data that is not in the file', async () => {
    const backup = await createBackup(); // empty backup
    await seedDatabase();
    expect(await db.exercises.count()).toBe(1);

    await importBackup(backup, 'replace');
    expect(await db.exercises.count()).toBe(0);
    expect(await db.workoutSessions.count()).toBe(0);
  });

  it('survives a full round trip without changing the data', async () => {
    await seedDatabase();
    const before = await createBackup();

    await importBackup(before, 'replace');
    const after = await createBackup();

    expect(after.exercises).toEqual(before.exercises);
    expect(after.workoutSets).toEqual(before.workoutSets);
    expect(after.workoutSessions).toEqual(before.workoutSessions);
  });
});

describe('importBackup — merge', () => {
  it('adds only records that do not exist yet', async () => {
    await seedDatabase();
    const backup = await createBackup();

    // Importing the same file again must not create duplicates.
    const result = await importBackup(backup, 'merge');

    expect(result.added.exercises).toBe(0);
    expect(result.skipped.exercises).toBe(1);
    expect(await db.exercises.count()).toBe(1);
    expect(await db.workoutSets.count()).toBe(1);
  });

  it('keeps local records untouched on an id conflict', async () => {
    await seedDatabase();
    const backup = await createBackup();

    // The local copy was renamed after the backup was taken.
    const exerciseId = backup.exercises[0].id;
    await db.exercises.update(exerciseId, { name: 'Lokal umbenannt' });

    await importBackup(backup, 'merge');

    expect((await db.exercises.get(exerciseId))?.name).toBe('Lokal umbenannt');
  });

  it('combines two disjoint databases', async () => {
    await seedDatabase();
    const first = await createBackup();

    await resetDatabase();
    await seedDatabase(); // different UUIDs
    const second = await createBackup();

    await importBackup(first, 'merge');

    expect(await db.exercises.count()).toBe(2);
    expect(await db.workoutSessions.count()).toBe(2);
    expect(second.exercises[0].id).not.toBe(first.exercises[0].id);
  });

  it('leaves at most one active session behind', async () => {
    await startFreeSession('Läuft gerade');
    const backup = await createBackup();

    await resetDatabase();
    await startFreeSession('Andere Einheit');

    await importBackup(backup, 'merge');

    const active = await db.workoutSessions.where('status').equals('active').toArray();
    expect(active).toHaveLength(1);
  });
});

describe('import failure handling', () => {
  it('leaves the database untouched when the import fails', async () => {
    await seedDatabase();
    const backup = await createBackup();
    const exerciseCountBefore = await db.exercises.count();

    // A record without an id cannot be written; the transaction must roll back.
    const broken = {
      ...backup,
      exercises: [...backup.exercises, { ...backup.exercises[0], id: undefined }],
    } as unknown as typeof backup;

    await expect(importBackup(broken, 'replace')).rejects.toThrow();

    expect(await db.exercises.count()).toBe(exerciseCountBefore);
    expect(await db.workoutSets.count()).toBe(1);
  });
});
