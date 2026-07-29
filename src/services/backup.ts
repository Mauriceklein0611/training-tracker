import { z } from 'zod';
import { db, SCHEMA_VERSION, type TrainingDatabase } from '@/db/db';
import {
  aiAnalysisSchema,
  aiExportRecordSchema,
  appSettingsSchema,
  bodyWeightEntrySchema,
  equipmentProfileSchema,
  exerciseSchema,
  planImportRecordSchema,
  planDeloadPeriodSchema,
  planScheduleSchema,
  planScheduleExceptionSchema,
  planUsagePeriodSchema,
  scheduleEntrySchema,
  sessionExerciseSchema,
  trainingPlanSchema,
  templateExerciseSchema,
  templateVersionSchema,
  workoutSessionSchema,
  workoutSetSchema,
  workoutTemplateSchema,
  workoutUnitTemplateSchema,
  workoutUnitTemplateExerciseSchema,
} from '@/db/schemas';
import { nowIso } from '@/utils/id';
import { dayKey } from '@/utils/date';
import { wrapOrphanTemplatesInPlans } from '@/db/planMigration';
import { ensureSchedulesForPlans } from '@/db/scheduleMigration';

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
  // Added in schema version 17; defaulted so older backups (which have no plans,
  // only templates) still validate and are wrapped into plans on restore.
  trainingPlans: z.array(trainingPlanSchema).default([]),
  workoutTemplates: z.array(workoutTemplateSchema),
  templateExercises: z.array(templateExerciseSchema),
  // Added in schema version 10; defaulted so older backups without it still validate.
  templateVersions: z.array(templateVersionSchema).default([]),
  workoutSessions: z.array(workoutSessionSchema),
  sessionExercises: z.array(sessionExerciseSchema),
  workoutSets: z.array(workoutSetSchema),
  bodyWeightEntries: z.array(bodyWeightEntrySchema),
  // Added in schema version 11; defaulted so older backups still validate.
  aiAnalyses: z.array(aiAnalysisSchema).default([]),
  // Added in schema version 13.
  equipmentProfiles: z.array(equipmentProfileSchema).default([]),
  // Added in schema version 18; defaulted so older backups still validate. A
  // pre-schedule backup is given a default free-rotation schedule per plan on
  // restore (see ensureSchedulesForPlans below).
  planSchedules: z.array(planScheduleSchema).default([]),
  scheduleEntries: z.array(scheduleEntrySchema).default([]),
  // Added in schema version 19; defaulted so older backups still validate and
  // restore with an empty library.
  workoutUnitTemplates: z.array(workoutUnitTemplateSchema).default([]),
  workoutUnitTemplateExercises: z.array(workoutUnitTemplateExerciseSchema).default([]),
  // Added in schema version 21; defaulted so older backups still validate.
  planUsagePeriods: z.array(planUsagePeriodSchema).default([]),
  // Added in schema version 22; defaulted so older backups still validate.
  planDeloadPeriods: z.array(planDeloadPeriodSchema).default([]),
  // Added in schema version 25; defaulted so older backups still validate.
  planScheduleExceptions: z.array(planScheduleExceptionSchema).default([]),
  // Added in schema version 11 (store) / covered here since v15; defaulted so
  // older backups without it still validate and import as an empty list.
  aiExports: z.array(aiExportRecordSchema).default([]),
  // Added in schema version 16; defaulted so older backups still validate.
  planImports: z.array(planImportRecordSchema).default([]),
});

export type BackupFile = z.infer<typeof backupFileSchema>;

export interface BackupCounts {
  exercises: number;
  trainingPlans: number;
  workoutTemplates: number;
  templateExercises: number;
  templateVersions: number;
  workoutSessions: number;
  sessionExercises: number;
  workoutSets: number;
  bodyWeightEntries: number;
  aiAnalyses: number;
  equipmentProfiles: number;
  planSchedules: number;
  scheduleEntries: number;
  workoutUnitTemplates: number;
  workoutUnitTemplateExercises: number;
  planUsagePeriods: number;
  planDeloadPeriods: number;
  planScheduleExceptions: number;
  aiExports: number;
  planImports: number;
}

export function countBackupRecords(backup: BackupFile): BackupCounts {
  return {
    exercises: backup.exercises.length,
    trainingPlans: backup.trainingPlans.length,
    workoutTemplates: backup.workoutTemplates.length,
    templateExercises: backup.templateExercises.length,
    templateVersions: backup.templateVersions.length,
    workoutSessions: backup.workoutSessions.length,
    sessionExercises: backup.sessionExercises.length,
    workoutSets: backup.workoutSets.length,
    bodyWeightEntries: backup.bodyWeightEntries.length,
    aiAnalyses: backup.aiAnalyses.length,
    equipmentProfiles: backup.equipmentProfiles.length,
    planSchedules: backup.planSchedules.length,
    scheduleEntries: backup.scheduleEntries.length,
    workoutUnitTemplates: backup.workoutUnitTemplates.length,
    workoutUnitTemplateExercises: backup.workoutUnitTemplateExercises.length,
    planUsagePeriods: backup.planUsagePeriods.length,
    planDeloadPeriods: backup.planDeloadPeriods.length,
    planScheduleExceptions: backup.planScheduleExceptions.length,
    aiExports: backup.aiExports.length,
    planImports: backup.planImports.length,
  };
}

export const BACKUP_COUNT_LABELS: Record<keyof BackupCounts, string> = {
  exercises: 'Übungen',
  trainingPlans: 'Trainingspläne',
  workoutTemplates: 'Trainingstage',
  templateExercises: 'Planübungen',
  templateVersions: 'Wiederherstellungspunkte',
  workoutSessions: 'Trainingseinheiten',
  sessionExercises: 'Übungen in Einheiten',
  workoutSets: 'Sätze',
  bodyWeightEntries: 'Körpergewichtseinträge',
  aiAnalyses: 'KI-Analysen',
  equipmentProfiles: 'Equipment-Profile',
  planSchedules: 'Zeitpläne',
  scheduleEntries: 'Zeitplan-Einträge',
  workoutUnitTemplates: 'Übungseinheiten (Bibliothek)',
  workoutUnitTemplateExercises: 'Übungen in Bibliothekseinheiten',
  planUsagePeriods: 'Plan-Nutzungszeiträume',
  planDeloadPeriods: 'Deload-Zeiträume',
  planScheduleExceptions: 'Zeitplan-Ausnahmen',
  aiExports: 'KI-Export-Vermerke',
  planImports: 'Plan-Import-Vermerke',
};

/** Reads the whole database into a backup object. */
export async function createBackup(database: TrainingDatabase = db): Promise<BackupFile> {
  const [
    settings,
    exercises,
    trainingPlans,
    workoutTemplates,
    templateExercises,
    workoutSessions,
    sessionExercises,
    workoutSets,
    bodyWeightEntries,
    templateVersions,
    aiAnalyses,
    equipmentProfiles,
    planSchedules,
    scheduleEntries,
    workoutUnitTemplates,
    workoutUnitTemplateExercises,
    planUsagePeriods,
    planDeloadPeriods,
    planScheduleExceptions,
    aiExports,
    planImports,
  ] = await Promise.all([
    database.settings.get('app-settings'),
    database.exercises.toArray(),
    database.trainingPlans.toArray(),
    database.workoutTemplates.toArray(),
    database.templateExercises.toArray(),
    database.workoutSessions.toArray(),
    database.sessionExercises.toArray(),
    database.workoutSets.toArray(),
    database.bodyWeightEntries.toArray(),
    database.templateVersions.toArray(),
    database.aiAnalyses.toArray(),
    database.equipmentProfiles.toArray(),
    database.planSchedules.toArray(),
    database.scheduleEntries.toArray(),
    database.workoutUnitTemplates.toArray(),
    database.workoutUnitTemplateExercises.toArray(),
    database.planUsagePeriods.toArray(),
    database.planDeloadPeriods.toArray(),
    database.planScheduleExceptions.toArray(),
    database.aiExports.toArray(),
    database.planImports.toArray(),
  ]);

  return backupFileSchema.parse({
    exportFormatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowIso(),
    app: 'training-tracker',
    settings: settings ?? null,
    exercises,
    trainingPlans,
    workoutTemplates,
    templateExercises,
    templateVersions,
    workoutSessions,
    sessionExercises,
    workoutSets,
    bodyWeightEntries,
    aiAnalyses,
    equipmentProfiles,
    planSchedules,
    scheduleEntries,
    workoutUnitTemplates,
    workoutUnitTemplateExercises,
    planUsagePeriods,
    planDeloadPeriods,
    planScheduleExceptions,
    aiExports,
    planImports,
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

  // A backup from a newer, unsupported database version is rejected outright
  // rather than imported with unknown fields silently stripped away.
  if (backup.schemaVersion > SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [
        `Diese Datei stammt aus einer neueren Datenbankversion (${backup.schemaVersion}) ` +
          `als diese App unterstützt (${SCHEMA_VERSION}). Bitte aktualisiere zuerst die App, ` +
          'damit keine unbekannten Daten verloren gehen.',
      ],
    };
  }

  const warnings: string[] = [];

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
    warnings.push(
      `${orphanExercises} Übungseinträge verweisen auf fehlende Trainingseinheiten.`,
    );
  }
  if (orphanSets > 0) {
    warnings.push(
      orphanSets === 1
        ? `1 Satz verweist auf einen fehlenden Übungseintrag.`
        : `${orphanSets} Sätze verweisen auf fehlende Übungseinträge.`,
    );
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
    trainingPlans: 0,
    workoutTemplates: 0,
    templateExercises: 0,
    templateVersions: 0,
    workoutSessions: 0,
    sessionExercises: 0,
    workoutSets: 0,
    bodyWeightEntries: 0,
    aiAnalyses: 0,
    equipmentProfiles: 0,
    planSchedules: 0,
    scheduleEntries: 0,
    workoutUnitTemplates: 0,
    workoutUnitTemplateExercises: 0,
    planUsagePeriods: 0,
    planDeloadPeriods: 0,
    planScheduleExceptions: 0,
    aiExports: 0,
    planImports: 0,
  };
}

const TABLE_KEYS = [
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
  'equipmentProfiles',
  'planSchedules',
  'scheduleEntries',
  'workoutUnitTemplates',
  'workoutUnitTemplateExercises',
  'planUsagePeriods',
  'planDeloadPeriods',
  'planScheduleExceptions',
  'aiExports',
  'planImports',
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
      database.trainingPlans,
      database.workoutTemplates,
      database.templateExercises,
      database.templateVersions,
      database.workoutSessions,
      database.sessionExercises,
      database.workoutSets,
      database.bodyWeightEntries,
      database.aiAnalyses,
      database.equipmentProfiles,
      database.planSchedules,
      database.scheduleEntries,
      database.workoutUnitTemplates,
      database.workoutUnitTemplateExercises,
      database.planUsagePeriods,
      database.planDeloadPeriods,
      database.planScheduleExceptions,
      database.aiExports,
      database.planImports,
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
          await (
            database[key] as { bulkPut: (r: unknown[]) => Promise<unknown> }
          ).bulkPut(rows);
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
          await (
            database[key] as { bulkPut: (r: unknown[]) => Promise<unknown> }
          ).bulkPut(newRows);
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

      // A backup written before the split system (schema < 17) carries days
      // without an owning plan; wrap them so every day belongs to a plan.
      await wrapOrphanTemplatesInPlans(database.trainingPlans, database.workoutTemplates);

      // A backup written before the schedule system (schema < 18) has no
      // schedules; give every plan a default free-rotation schedule so the
      // restored plans behave exactly as they did before.
      await ensureSchedulesForPlans(database.trainingPlans, database.planSchedules);

      // Enforce the "at most one active session" invariant after any import.
      const active = await database.workoutSessions
        .where('status')
        .equals('active')
        .toArray();
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
  return `training-backup-${dayKey(date)}.json`;
}
