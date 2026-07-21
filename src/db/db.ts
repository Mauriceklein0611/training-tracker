import Dexie, { type Table } from 'dexie';
import type {
  AppSettings,
  BodyWeightEntry,
  Exercise,
  SessionExercise,
  TemplateExercise,
  WorkoutSession,
  WorkoutSet,
  WorkoutTemplate,
} from '@/types';
import { nowIso } from '@/utils/id';

/**
 * Current database schema version.
 *
 * Bump this together with a new `.version()` block below and record the change
 * in MIGRATIONS so the settings screen can show what the database went through.
 */
export const SCHEMA_VERSION = 4;

export const MIGRATIONS: { version: number; description: string }[] = [
  { version: 1, description: 'Initiales Schema: Übungen, Pläne, Einheiten, Sätze.' },
  {
    version: 2,
    description:
      'Körpergewichtstagebuch, Index auf Satz-Abschlusszeit, Standardwerte für ' +
      'weightMultiplier und archived nachgetragen.',
  },
  {
    version: 3,
    description:
      'Körperdaten erweitert: Körperfettanteil und Umfangsmaße je Eintrag. ' +
      'Das Gewicht ist dadurch optional geworden.',
  },
  {
    version: 4,
    description:
      'Übungen in Trainingseinheiten merken sich jetzt die aufgelöste Pausenzeit ' +
      'und das Satzziel als Snapshot, damit spätere Änderungen an einer Übung ' +
      'vergangene Trainings nicht rückwirkend verändern.',
  },
];

export class TrainingDatabase extends Dexie {
  exercises!: Table<Exercise, string>;
  workoutTemplates!: Table<WorkoutTemplate, string>;
  templateExercises!: Table<TemplateExercise, string>;
  workoutSessions!: Table<WorkoutSession, string>;
  sessionExercises!: Table<SessionExercise, string>;
  workoutSets!: Table<WorkoutSet, string>;
  bodyWeightEntries!: Table<BodyWeightEntry, string>;
  settings!: Table<AppSettings, string>;

  constructor(name = 'training-tracker') {
    super(name);

    // ---- v1 -------------------------------------------------------------
    // Indexes are chosen for the queries the app actually runs: listing by
    // name, looking up children by parent id, and scanning sessions by date.
    this.version(1).stores({
      exercises: 'id, name, primaryMuscleGroup, equipment, archived',
      workoutTemplates: 'id, name, updatedAt',
      templateExercises: 'id, templateId, exerciseId, [templateId+order]',
      workoutSessions: 'id, status, startedAt, templateId',
      sessionExercises: 'id, sessionId, exerciseId, [sessionId+order]',
      workoutSets: 'id, sessionExerciseId, [sessionExerciseId+position]',
      settings: 'id',
    });

    // ---- v2 -------------------------------------------------------------
    this.version(2)
      .stores({
        bodyWeightEntries: 'id, date',
        workoutSets: 'id, sessionExerciseId, completedAt, [sessionExerciseId+position]',
      })
      .upgrade(async (tx) => {
        // Backfill fields that were optional in v1 so later code can rely on them.
        await tx
          .table<Exercise>('exercises')
          .toCollection()
          .modify((exercise) => {
            if (typeof exercise.weightMultiplier !== 'number') exercise.weightMultiplier = 1;
            if (typeof exercise.archived !== 'boolean') exercise.archived = false;
            if (!Array.isArray(exercise.secondaryMuscleGroups)) {
              exercise.secondaryMuscleGroups = [];
            }
          });
        await tx
          .table<AppSettings>('settings')
          .toCollection()
          .modify((settings) => {
            settings.schemaVersion = 2;
          });
      });

    // ---- v3 -------------------------------------------------------------
    // Body entries gained optional body fat and circumference fields. The
    // indexes are unchanged; existing rows stay valid because every new field
    // is optional, so this upgrade only records the new version.
    this.version(3).upgrade(async (tx) => {
      await tx
        .table<AppSettings>('settings')
        .toCollection()
        .modify((settings) => {
          settings.schemaVersion = 3;
        });
    });

    // ---- v4 -------------------------------------------------------------
    // SessionExercise gained restSecondsSnapshot / targetSetsSnapshot.
    //
    // Existing rows predate the snapshot, so the value is reconstructed from
    // the exercise's current default (falling back to the global default).
    // This is safe for history: sets already carry their own
    // `restTargetSeconds`, and the snapshot only seeds *new* sets. The target
    // set count stays undefined — it cannot be recovered and its absence
    // simply means "no set goal", which is the pre-v4 behaviour.
    this.version(4).upgrade(async (tx) => {
      const settings = await tx.table<AppSettings>('settings').get('app-settings');
      const globalDefault = settings?.defaultRestSeconds ?? 120;

      const exercises = await tx.table<Exercise>('exercises').toArray();
      const defaultsById = new Map(
        exercises.map((exercise) => [exercise.id, exercise.defaultRestSeconds]),
      );

      await tx
        .table<SessionExercise>('sessionExercises')
        .toCollection()
        .modify((entry) => {
          if (typeof entry.restSecondsSnapshot !== 'number') {
            entry.restSecondsSnapshot = defaultsById.get(entry.exerciseId) ?? globalDefault;
          }
        });

      await tx
        .table<AppSettings>('settings')
        .toCollection()
        .modify((current) => {
          current.schemaVersion = 4;
        });
    });
  }
}

export const db = new TrainingDatabase();

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'app-settings',
  unit: 'kg',
  defaultRestSeconds: 120,
  defaultAnalyticsRange: '30d',
  darkMode: 'dark',
  restSoundEnabled: true,
  restVibrationEnabled: true,
  backupReminderDays: 14,
  schemaVersion: SCHEMA_VERSION,
  createdAt: '',
  updatedAt: '',
};

/**
 * Reads the settings singleton, creating it on first launch.
 * Never throws for a missing row — the app must always come up.
 */
export async function ensureSettings(database: TrainingDatabase = db): Promise<AppSettings> {
  const existing = await database.settings.get('app-settings');
  if (existing) return { ...DEFAULT_SETTINGS, ...existing };

  const created: AppSettings = {
    ...DEFAULT_SETTINGS,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await database.settings.put(created);
  return created;
}

/** Opens the database and surfaces a readable error instead of a raw DOMException. */
export async function openDatabase(database: TrainingDatabase = db): Promise<void> {
  try {
    await database.open();
    await ensureSettings(database);
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'VersionError') {
      throw new Error(
        'Die lokale Datenbank wurde von einer neueren App-Version erstellt. ' +
          'Bitte lade die App neu oder aktualisiere sie.',
      );
    }
    throw new Error(
      'Der lokale Speicher (IndexedDB) konnte nicht geöffnet werden. ' +
        'Im privaten Modus mancher Browser ist er nicht verfügbar. ' +
        `Technische Meldung: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
