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
import { addExerciseToTemplate, createTemplate } from '@/db/repositories/templates';
import { createTemplateVersion } from '@/db/repositories/templateVersions';
import { upsertBodyWeightEntry } from '@/db/repositories/bodyWeight';
import {
  addSet,
  addExerciseToSession,
  attachSessionExerciseToPrevious,
  completeSet,
  finishSession,
  setPostCheckIn,
  setPreCheckIn,
  startFreeSession,
} from '@/db/repositories/sessions';
import { updateSettings } from '@/db/repositories/settings';
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

describe('compatibility with older backup files', () => {
  /** Strips fields that were introduced after the file would have been written. */
  async function makeLegacyBackup() {
    await seedDatabase();
    const raw = JSON.parse(JSON.stringify(await createBackup()));
    for (const entry of raw.sessionExercises) {
      delete entry.restSecondsSnapshot;
      delete entry.targetSetsSnapshot;
    }
    for (const entry of raw.bodyWeightEntries) {
      delete entry.bodyFatPercent;
      delete entry.measurements;
    }
    raw.schemaVersion = 2;
    return raw;
  }

  it('accepts a backup written before the new fields existed', async () => {
    const legacy = await makeLegacyBackup();
    const result = validateBackupJson(legacy);

    expect(result.ok).toBe(true);
  });

  it('fills the missing rest snapshot with a safe default on import', async () => {
    const legacy = await makeLegacyBackup();
    const result = validateBackupJson(legacy);
    if (!result.ok) throw new Error('Backup sollte gültig sein');

    await resetDatabase();
    await importBackup(result.backup, 'replace');

    const entry = await db.sessionExercises.toCollection().first();
    expect(entry?.restSecondsSnapshot).toBe(120);
    expect(entry?.targetSetsSnapshot).toBeUndefined();
    // The actual sets keep the rest they were recorded with.
    expect((await db.workoutSets.toCollection().first())?.restTargetSeconds).toBe(120);
  });

  it('loses no records when importing a legacy backup', async () => {
    const legacy = await makeLegacyBackup();
    const result = validateBackupJson(legacy);
    if (!result.ok) throw new Error('Backup sollte gültig sein');

    await resetDatabase();
    await importBackup(result.backup, 'replace');

    expect(await db.exercises.count()).toBe(1);
    expect(await db.workoutSessions.count()).toBe(1);
    expect(await db.sessionExercises.count()).toBe(1);
    expect(await db.workoutSets.count()).toBe(1);
    expect(await db.bodyWeightEntries.count()).toBe(1);
  });

  it('survives a round trip through the current format', async () => {
    const legacy = await makeLegacyBackup();
    const result = validateBackupJson(legacy);
    if (!result.ok) throw new Error('Backup sollte gültig sein');

    await resetDatabase();
    await importBackup(result.backup, 'replace');
    const current = await createBackup();

    await resetDatabase();
    await importBackup(current, 'replace');
    const again = await createBackup();

    expect(again.sessionExercises).toEqual(current.sessionExercises);
    expect(again.workoutSets).toEqual(current.workoutSets);
  });
});

describe('weekly goals round trip', () => {
  it('preserves weekly goals through backup and restore', async () => {
    await seedDatabase();
    await updateSettings({
      weeklyGoals: {
        sessionsPerWeek: 4,
        workingSetsPerWeek: 60,
        exerciseGoals: [
          { exerciseId: 'squat', exerciseNameSnapshot: 'Kniebeuge', sessionsPerWeek: 2 },
        ],
      },
    });

    const backup = await createBackup();
    expect(backup.settings?.weeklyGoals?.sessionsPerWeek).toBe(4);

    await resetDatabase();
    await importBackup(backup, 'replace');

    const restored = await db.settings.get('app-settings');
    expect(restored?.weeklyGoals?.sessionsPerWeek).toBe(4);
    expect(restored?.weeklyGoals?.workingSetsPerWeek).toBe(60);
    expect(restored?.weeklyGoals?.exerciseGoals?.[0]?.exerciseNameSnapshot).toBe('Kniebeuge');
  });

  it('accepts a backup written before weekly goals existed', async () => {
    await seedDatabase();
    const raw = JSON.parse(JSON.stringify(await createBackup()));
    delete raw.settings.weeklyGoals;
    raw.schemaVersion = 6;

    const result = validateBackupJson(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await resetDatabase();
    await importBackup(result.backup, 'replace');
    const restored = await db.settings.get('app-settings');
    expect(restored?.weeklyGoals).toBeUndefined();
  });
});

describe('AI analysis round trip', () => {
  it('preserves imported AI analyses through backup and restore', async () => {
    await db.aiAnalyses.put({
      id: 'a1',
      importedAt: '2026-07-22T10:00:00.000Z',
      exportId: 'exp-1',
      summary: 'Solide Basis',
      strengths: ['Regelmäßig'],
      observations: [{ title: 'Volumen', text: 'stabil' }],
      recommendations: ['Pausen verlängern'],
      importFingerprint: 'fp1',
      proposals: [
        {
          proposalId: 'p1',
          operation: 'update_template_exercise_target',
          target: { templateId: 't1', templateExerciseId: 'te1' },
          changes: { sets: 4 },
          reason: 'Progression',
          status: 'applied',
        },
      ],
    });

    const backup = await createBackup();
    expect(backup.aiAnalyses).toHaveLength(1);

    await resetDatabase();
    await importBackup(backup, 'replace');
    const restored = await db.aiAnalyses.get('a1');
    expect(restored?.summary).toBe('Solide Basis');
    expect(restored?.proposals[0].status).toBe('applied');
  });

  it('accepts a backup written before AI analyses existed', async () => {
    await seedDatabase();
    const raw = JSON.parse(JSON.stringify(await createBackup()));
    delete raw.aiAnalyses;
    raw.schemaVersion = 10;
    const result = validateBackupJson(raw);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.backup.aiAnalyses).toEqual([]);
  });
});

describe('plan version round trip', () => {
  it('preserves plan versions through backup and restore', async () => {
    const { exercise } = await seedDatabase();
    const template = await createTemplate('Push');
    await addExerciseToTemplate(template.id, exercise);
    const version = await createTemplateVersion(template.id, { label: 'Start' });

    const backup = await createBackup();
    expect(backup.templateVersions).toHaveLength(1);
    expect(backup.templateVersions[0].id).toBe(version.id);

    await resetDatabase();
    await importBackup(backup, 'replace');
    const restored = await db.templateVersions.get(version.id);
    expect(restored?.snapshot.exercises).toHaveLength(1);
    expect(restored?.label).toBe('Start');
  });

  it('accepts a backup written before plan versions existed', async () => {
    await seedDatabase();
    const raw = JSON.parse(JSON.stringify(await createBackup()));
    delete raw.templateVersions;
    raw.schemaVersion = 9;
    const result = validateBackupJson(raw);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.backup.templateVersions).toEqual([]);
  });
});

describe('check-in round trip', () => {
  it('preserves pre and post check-in through backup and restore', async () => {
    const session = await startFreeSession('Check-in');
    await setPreCheckIn(session.id, { energy: 4, sleepQuality: 3, painNote: 'Knie' });
    await setPostCheckIn(session.id, { quality: 5, satisfaction: 4 });
    await finishSession(session.id);

    const backup = await createBackup();
    const stored = backup.workoutSessions.find((entry) => entry.id === session.id);
    expect(stored?.preCheckIn?.energy).toBe(4);
    expect(stored?.postCheckIn?.quality).toBe(5);

    await resetDatabase();
    await importBackup(backup, 'replace');
    const restored = await db.workoutSessions.get(session.id);
    expect(restored?.preCheckIn?.painNote).toBe('Knie');
    expect(restored?.postCheckIn?.satisfaction).toBe(4);
  });

  it('accepts a backup written before check-in existed', async () => {
    await seedDatabase();
    const raw = JSON.parse(JSON.stringify(await createBackup()));
    for (const entry of raw.workoutSessions) {
      delete entry.preCheckIn;
      delete entry.postCheckIn;
    }
    raw.schemaVersion = 8;
    expect(validateBackupJson(raw).ok).toBe(true);
  });
});

describe('superset grouping round trip', () => {
  it('preserves group fields on template and session exercises', async () => {
    const exercise = await createExercise({
      name: 'Bankdrücken',
      primaryMuscleGroup: 'Brust',
      secondaryMuscleGroups: [],
      equipment: '',
      trackingType: 'weight_reps',
      weightMode: 'total',
      weightMultiplier: 1,
      defaultRestSeconds: 120,
      notes: '',
    });
    const session = await startFreeSession('Superset');
    await addExerciseToSession(session.id, exercise);
    const seB = await addExerciseToSession(session.id, exercise);
    await attachSessionExerciseToPrevious(seB.id);

    const backup = await createBackup();
    const grouped = backup.sessionExercises.filter((entry) => entry.groupId);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].groupId).toBe(grouped[1].groupId);
    expect(grouped[0].groupType).toBe('superset');

    await resetDatabase();
    await importBackup(backup, 'replace');
    const restored = (await db.sessionExercises.toArray()).filter((entry) => entry.groupId);
    expect(restored).toHaveLength(2);
    expect(restored[0].groupId).toBe(restored[1].groupId);
  });

  it('accepts a backup written before grouping existed', async () => {
    await seedDatabase();
    const raw = JSON.parse(JSON.stringify(await createBackup()));
    for (const entry of raw.sessionExercises) {
      delete entry.groupId;
      delete entry.groupType;
      delete entry.groupRestMode;
    }
    raw.schemaVersion = 7;
    expect(validateBackupJson(raw).ok).toBe(true);
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
