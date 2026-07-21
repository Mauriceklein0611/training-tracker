import { z } from 'zod';
import { db, SCHEMA_VERSION, type TrainingDatabase } from '@/db/db';
import {
  appSettingsSchema,
  bodyWeightEntrySchema,
  exerciseSchema,
  sessionExerciseSchema,
  templateExerciseSchema,
  workoutSessionSchema,
  workoutSetSchema,
  workoutTemplateSchema,
} from '@/db/schemas';
import { nowIso } from '@/utils/id';

/**
 * Full technical backup: a lossless dump of every table that can be restored
 * one-to-one. This is deliberately different from the AI export, which is a
 * curated, human-readable subset.
 */

export const BACKUP_FORMAT_VERSION = 1;

export const backupFileSchema = z.object({
  exportFormatVersion: z.number().int().min(1),
  schemaVersion: z.number().int().min(1),
  exportedAt: z.string(),
  app: z.string().optional(),
  settings: appSettingsSchema.nullable().optional(),
  exercises: z.array(exerciseSchema),
  workoutTemplates: z.array(workoutTemplateSchema),
  templateExercises: z.array(templateExerciseSchema),
  workoutSessions: z.array(workoutSessionSchema),
  sessionExercises: z.array(sessionExerciseSchema),
  workoutSets: z.array(workoutSetSchema),
  bodyWeightEntries: z.array(bodyWeightEntrySchema),
});

export type BackupFile = z.infer<typeof backupFileSchema>;

export interface BackupCounts {
  exercises: number;
  workoutTemplates: number;
  templateExercises: number;
  workoutSessions: number;
  sessionExercises: number;
  workoutSets: number;
  bodyWeightEntries: number;
}

export function countBackupRecords(backup: BackupFile): BackupCounts {
  return {
    exercises: backup.exercises.length,
    workoutTemplates: backup.workoutTemplates.length,
    templateExercises: backup.templateExercises.length,
    workoutSessions: backup.workoutSessions.length,
    sessionExercises: backup.sessionExercises.length,
    workoutSets: backup.workoutSets.length,
    bodyWeightEntries: backup.bodyWeightEntries.length,
  };
}

export const BACKUP_COUNT_LABELS: Record<keyof BackupCounts, string> = {
  exercises: 'Übungen',
  workoutTemplates: 'Trainingspläne',
  templateExercises: 'Planübungen',
  workoutSessions: 'Trainingseinheiten',
  sessionExercises: 'Übungen in Einheiten',
  workoutSets: 'Sätze',
  bodyWeightEntries: 'Körpergewichtseinträge',
};

/** Reads the whole database into a backup object. */
export async function createBackup(database: TrainingDatabase = db): Promise<BackupFile> {
  const [
    settings,
    exercises,
    workoutTemplates,
    templateExercises,
    workoutSessions,
    sessionExercises,
    workoutSets,
    bodyWeightEntries,
  ] = await Promise.all([
    database.settings.get('app-settings'),
    database.exercises.toArray(),
    database.workoutTemplates.toArray(),
    database.templateExercises.toArray(),
    database.workoutSessions.toArray(),
    database.sessionExercises.toArray(),
    database.workoutSets.toArray(),
    database.bodyWeightEntries.toArray(),
  ]);

  return backupFileSchema.parse({
    exportFormatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowIso(),
    app: 'training-tracker',
    settings: settings ?? null,
    exercises,
    workoutTemplates,
    templateExercises,
    workoutSessions,
    sessionExercises,
    workoutSets,
    bodyWeightEntries,
  });
}

export type BackupValidationResult =
  | { ok: true; backup: BackupFile; counts: BackupCounts; warnings: string[] }
  | { ok: false; errors: string[] };

/**
 * Validates an uploaded file.
 *
 * Rejects anything that is not a backup of this app with a message the user can
 * act on, rather than letting a malformed file reach the database.
 */
export function validateBackupJson(raw: unknown): BackupValidationResult {
  const parsed = backupFileSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = parsed.error.issues.slice(0, 8).map((issue) => {
      const path = issue.path.join('.') || 'Datei';
      return `${path}: ${issue.message}`;
    });
    if (parsed.error.issues.length > 8) {
      errors.push(`… und ${parsed.error.issues.length - 8} weitere Probleme.`);
    }
    return { ok: false, errors };
  }

  const backup = parsed.data;
  if (backup.exportFormatVersion > BACKUP_FORMAT_VERSION) {
    return {
      ok: false,
      errors: [
        `Diese Datei wurde mit einem neueren Exportformat (Version ` +
          `${backup.exportFormatVersion}) erstellt. Bitte aktualisiere zuerst die App.`,
      ],
    };
  }

  const warnings: string[] = [];
  if (backup.schemaVersion > SCHEMA_VERSION) {
    warnings.push(
      `Die Datei stammt aus einer neueren Datenbankversion (${backup.schemaVersion}). ` +
        'Unbekannte Felder werden beim Import ignoriert.',
    );
  }

  // Referential integrity: dangling children would silently disappear from the UI.
  const sessionIds = new Set(backup.workoutSessions.map((session) => session.id));
  const sessionExerciseIds = new Set(backup.sessionExercises.map((entry) => entry.id));
  const orphanExercises = backup.sessionExercises.filter(
    (entry) => !sessionIds.has(entry.sessionId),
  ).length;
  const orphanSets = backup.workoutSets.filter(
    (set) => !sessionExerciseIds.has(set.sessionExerciseId),
  ).length;

  if (orphanExercises > 0) {
    warnings.push(`${orphanExercises} Übungseinträge verweisen auf fehlende Trainingseinheiten.`);
  }
  if (orphanSets > 0) {
    warnings.push(`${orphanSets} Sätze verweisen auf fehlende Übungseinträge.`);
  }

  const activeSessions = backup.workoutSessions.filter(
    (session) => session.status === 'active',
  ).length;
  if (activeSessions > 1) {
    warnings.push(
      `Die Datei enthält ${activeSessions} aktive Trainingseinheiten. ` +
        'Beim Import bleibt nur die neueste aktiv.',
    );
  }

  return { ok: true, backup, counts: countBackupRecords(backup), warnings };
}

/** Parses a JSON string and validates it. */
export function parseBackupFile(text: string): BackupValidationResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return {
      ok: false,
      errors: ['Die Datei ist keine gültige JSON-Datei und konnte nicht gelesen werden.'],
    };
  }
  return validateBackupJson(raw);
}

export type ImportMode = 'replace' | 'merge';

export interface ImportResult {
  mode: ImportMode;
  added: BackupCounts;
  skipped: BackupCounts;
}

function emptyCounts(): BackupCounts {
  return {
    exercises: 0,
    workoutTemplates: 0,
    templateExercises: 0,
    workoutSessions: 0,
    sessionExercises: 0,
    workoutSets: 0,
    bodyWeightEntries: 0,
  };
}

const TABLE_KEYS = [
  'exercises',
  'workoutTemplates',
  'templateExercises',
  'workoutSessions',
  'sessionExercises',
  'workoutSets',
  'bodyWeightEntries',
] as const;

/**
 * Writes a validated backup into the database.
 *
 * Runs inside a single Dexie transaction: if any step fails, nothing is
 * written and the previous data stays intact — a half-restored database would
 * be worse than no restore at all.
 *
 * - `replace` wipes all training data first (settings are merged, not wiped).
 * - `merge` adds records whose UUID is not present yet and keeps local records
 *   on conflict, so an import can never overwrite newer local data.
 */
export async function importBackup(
  backup: BackupFile,
  mode: ImportMode,
  database: TrainingDatabase = db,
): Promise<ImportResult> {
  const added = emptyCounts();
  const skipped = emptyCounts();

  await database.transaction(
    'rw',
    [
      database.exercises,
      database.workoutTemplates,
      database.templateExercises,
      database.workoutSessions,
      database.sessionExercises,
      database.workoutSets,
      database.bodyWeightEntries,
      database.settings,
    ],
    async () => {
      if (mode === 'replace') {
        await Promise.all(TABLE_KEYS.map((key) => database[key].clear()));
      }

      for (const key of TABLE_KEYS) {
        const rows = backup[key] as { id: string }[];
        if (rows.length === 0) continue;

        if (mode === 'replace') {
          await (database[key] as { bulkPut: (r: unknown[]) => Promise<unknown> }).bulkPut(rows);
          added[key] = rows.length;
          continue;
        }

        const existingIds = new Set(
          (await database[key].bulkGet(rows.map((row) => row.id)))
            .filter((row): row is NonNullable<typeof row> => Boolean(row))
            .map((row) => row.id),
        );
        const newRows = rows.filter((row) => !existingIds.has(row.id));
        if (newRows.length > 0) {
          await (database[key] as { bulkPut: (r: unknown[]) => Promise<unknown> }).bulkPut(newRows);
        }
        added[key] = newRows.length;
        skipped[key] = rows.length - newRows.length;
      }

      if (backup.settings) {
        const current = await database.settings.get('app-settings');
        // Never let an import silently change the recorded schema version.
        await database.settings.put({
          ...backup.settings,
          ...(mode === 'merge' && current ? current : {}),
          id: 'app-settings',
          schemaVersion: SCHEMA_VERSION,
          updatedAt: nowIso(),
        });
      }

      // Enforce the "at most one active session" invariant after any import.
      const active = await database.workoutSessions.where('status').equals('active').toArray();
      if (active.length > 1) {
        active.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
        for (const session of active.slice(1)) {
          await database.workoutSessions.update(session.id, {
            status: 'completed',
            finishedAt: session.finishedAt ?? session.startedAt,
            updatedAt: nowIso(),
          });
        }
      }
    },
  );

  return { mode, added, skipped };
}

/** `training-backup-2026-07-21.json` */
export function backupFileName(date: Date = new Date()): string {
  return `training-backup-${date.toISOString().slice(0, 10)}.json`;
}
