import Dexie, { type Table } from 'dexie';
import type {
  AiAnalysis,
  AiExportRecord,
  PlanImportRecord,
  AppSettings,
  BodyWeightEntry,
  EquipmentProfile,
  Exercise,
  PlanSchedule,
  ScheduleEntry,
  SessionExercise,
  TemplateExercise,
  TemplateVersion,
  WorkoutUnitTemplate,
  WorkoutUnitTemplateExercise,
  TrainingPlan,
  WorkoutSession,
  WorkoutSet,
  WorkoutTemplate,
} from '@/types';
import { nowIso } from '@/utils/id';
import { wrapOrphanTemplatesInPlans } from '@/db/planMigration';
import { ensureSchedulesForPlans } from '@/db/scheduleMigration';

/**
 * Current database schema version.
 *
 * Bump this together with a new `.version()` block below and record the change
 * in MIGRATIONS so the settings screen can show what the database went through.
 */
export const SCHEMA_VERSION = 19;

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
  {
    version: 5,
    description:
      'Einstellung „Bildschirm während des Trainings aktiv halten“ sowie ' +
      'optionale Angaben zum Trainingskontext für den KI-Export.',
  },
  {
    version: 6,
    description:
      'Übungen können optional Gewichtsschritt, verfügbare Gewichte, ' +
      'bevorzugte Progressionsmethode und Ziel-RIR hinterlegen. ' +
      'Grundlage für die lokale Progressionsempfehlung.',
  },
  {
    version: 7,
    description:
      'Optionale Wochenziele (Trainingseinheiten und Arbeitssätze pro Woche, ' +
      'optional je Übung) für die Kalender- und Heatmap-Ansicht.',
  },
  {
    version: 8,
    description:
      'Übungen in Plänen und Einheiten können optional zu Supersätzen oder ' +
      'Zirkeln gruppiert werden (Gruppen-ID, Gruppentyp, Pausenmodus). ' +
      'Einzelübungen bleiben unverändert.',
  },
  {
    version: 9,
    description:
      'Optionaler Check-in vor und nach dem Training (Energie, Schlaf, ' +
      'Motivation, Muskelkater, wahrgenommene Qualität usw.). Rein subjektiv ' +
      'und freiwillig; ohne diese Angaben bleibt alles unverändert.',
  },
  {
    version: 10,
    description:
      'Trainingspläne können versioniert werden: gespeicherte, unveränderliche ' +
      'Planversionen zum Ansehen, Vergleichen und Wiederherstellen. Der aktive ' +
      'Plan bleibt in den bestehenden Tabellen unverändert.',
  },
  {
    version: 11,
    description:
      'KI-Rundweg: importierte KI-Analysen (Feedback und geprüfte Planvorschläge) ' +
      'werden lokal gespeichert. Zusätzlich werden erzeugte KI-Exporte vermerkt, ' +
      'um eine Antwortdatei ihrem Export zuordnen zu können.',
  },
  {
    version: 12,
    description:
      'Übungen können optionale Technik-Hinweise und manuell gewählte ' +
      'Alternativübungen hinterlegen. Beides ist optional; ohne Angabe bleibt ' +
      'alles unverändert.',
  },
  {
    version: 13,
    description:
      'Equipment-Profile (z. B. Zuhause, Fitnessstudio, Hotel) filtern optional ' +
      'die verfügbaren Übungen. Ohne aktives Profil ist alles verfügbar.',
  },
  {
    version: 14,
    description:
      'Optionale Sprachansage am Pausenende (Browser-Sprachausgabe, lokal). ' +
      'Standardmäßig aus; funktioniert nur, wo der Browser es unterstützt.',
  },
  {
    version: 15,
    description:
      'Übungen in Trainingseinheiten frieren beim Start zusätzlich Ziel-' +
      'Wiederholungen, Zieldauer und die Planübungs-ID als Snapshot ein, damit ' +
      'Änderungen am Plan ein laufendes Training nicht mehr verändern.',
  },
  {
    version: 16,
    description:
      'Importierte Trainingsplan-Pakete werden vermerkt, um einen doppelten ' +
      'Import derselben Datei erkennen und davor warnen zu können.',
  },
  {
    version: 17,
    description:
      'Split-System: neue trainingPlans-Tabelle als Elternebene über den ' +
      'Trainingstagen. Jeder bestehende Plan wird verlustfrei in einen Plan mit ' +
      'genau einem Tag („Tag A“) überführt; Übungen, Reihenfolge, Ziele, ' +
      'Versionen und Historie bleiben unverändert.',
  },
  {
    version: 18,
    description:
      'Zeitplan-System: jeder Plan erhält einen Zeitplan (freie Rotation, ' +
      'wiederholender Zyklus oder Wochenplan) mit Einträgen für Trainings- und ' +
      'Pausentage. Bestehende Pläne bekommen eine freie Rotation aus ihren ' +
      'Tagen in bisheriger Reihenfolge; die vorgeschlagene Rotation bleibt damit ' +
      'unverändert.',
  },
  {
    version: 19,
    description:
      'Bibliothek der Übungseinheiten: wiederverwendbare Einheiten und ihre ' +
      'Übungen als eigene Tabellen. Bestehende Pläne und Trainings bleiben ' +
      'unverändert; neue Herkunfts- und Direktstart-Snapshots sind optional.',
  },
];

export class TrainingDatabase extends Dexie {
  exercises!: Table<Exercise, string>;
  trainingPlans!: Table<TrainingPlan, string>;
  workoutTemplates!: Table<WorkoutTemplate, string>;
  templateExercises!: Table<TemplateExercise, string>;
  templateVersions!: Table<TemplateVersion, string>;
  workoutSessions!: Table<WorkoutSession, string>;
  sessionExercises!: Table<SessionExercise, string>;
  workoutSets!: Table<WorkoutSet, string>;
  bodyWeightEntries!: Table<BodyWeightEntry, string>;
  aiAnalyses!: Table<AiAnalysis, string>;
  aiExports!: Table<AiExportRecord, string>;
  planImports!: Table<PlanImportRecord, string>;
  equipmentProfiles!: Table<EquipmentProfile, string>;
  planSchedules!: Table<PlanSchedule, string>;
  scheduleEntries!: Table<ScheduleEntry, string>;
  workoutUnitTemplates!: Table<WorkoutUnitTemplate, string>;
  workoutUnitTemplateExercises!: Table<WorkoutUnitTemplateExercise, string>;
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
            if (typeof exercise.weightMultiplier !== 'number')
              exercise.weightMultiplier = 1;
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
            entry.restSecondsSnapshot =
              defaultsById.get(entry.exerciseId) ?? globalDefault;
          }
        });

      await tx
        .table<AppSettings>('settings')
        .toCollection()
        .modify((current) => {
          current.schemaVersion = 4;
        });
    });

    // ---- v5 -------------------------------------------------------------
    // Settings gained keepScreenAwake and the optional analysis context.
    // Only the settings row is touched; no training data is involved.
    this.version(5).upgrade(async (tx) => {
      await tx
        .table<AppSettings>('settings')
        .toCollection()
        .modify((settings) => {
          if (typeof settings.keepScreenAwake !== 'boolean') {
            // Sensible default for phone use in a gym.
            settings.keepScreenAwake = true;
          }
          settings.schemaVersion = 5;
        });
    });

    // ---- v6 -------------------------------------------------------------
    // Exercises gained optional progression settings. Every new field is
    // optional and absence means "not configured", so existing rows stay valid
    // exactly as they are — nothing is backfilled or guessed.
    this.version(6).upgrade(async (tx) => {
      await tx
        .table<AppSettings>('settings')
        .toCollection()
        .modify((settings) => {
          settings.schemaVersion = 6;
        });
    });

    // ---- v7 -------------------------------------------------------------
    // Settings gained optional weeklyGoals. The field is optional and its
    // absence means "no goals set", so existing rows stay valid untouched —
    // only the recorded schema version is advanced.
    this.version(7).upgrade(async (tx) => {
      await tx
        .table<AppSettings>('settings')
        .toCollection()
        .modify((settings) => {
          settings.schemaVersion = 7;
        });
    });

    // ---- v8 -------------------------------------------------------------
    // Template and session exercises gained optional grouping fields
    // (groupId / groupType / groupRestMode). Absence means "standalone
    // exercise", so nothing is backfilled — existing rows stay valid exactly
    // as they are and only the recorded schema version is advanced.
    this.version(8).upgrade(async (tx) => {
      await tx
        .table<AppSettings>('settings')
        .toCollection()
        .modify((settings) => {
          settings.schemaVersion = 8;
        });
    });

    // ---- v9 -------------------------------------------------------------
    // Sessions gained optional preCheckIn / postCheckIn. Both are optional and
    // absent means "not filled in", so existing sessions stay valid untouched —
    // only the recorded schema version is advanced.
    this.version(9).upgrade(async (tx) => {
      await tx
        .table<AppSettings>('settings')
        .toCollection()
        .modify((settings) => {
          settings.schemaVersion = 9;
        });
    });

    // ---- v10 ------------------------------------------------------------
    // New templateVersions store for immutable plan snapshots. Adding a store
    // leaves every existing row untouched; nothing is migrated or rebuilt.
    this.version(10)
      .stores({
        templateVersions: 'id, templateId, [templateId+versionNumber], createdAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table<AppSettings>('settings')
          .toCollection()
          .modify((settings) => {
            settings.schemaVersion = 10;
          });
      });

    // ---- v11 ------------------------------------------------------------
    // New stores for the AI round-trip: imported analyses and a small record of
    // generated exports. Both are additive; existing rows are untouched.
    this.version(11)
      .stores({
        aiAnalyses: 'id, importedAt, exportId, importFingerprint',
        aiExports: 'id, createdAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table<AppSettings>('settings')
          .toCollection()
          .modify((settings) => {
            settings.schemaVersion = 11;
          });
      });

    // ---- v12 ------------------------------------------------------------
    // Exercises gained optional techniqueCues / alternativeExerciseIds. Both are
    // optional arrays; their absence means "none", so existing rows stay valid
    // untouched and only the recorded schema version is advanced.
    this.version(12).upgrade(async (tx) => {
      await tx
        .table<AppSettings>('settings')
        .toCollection()
        .modify((settings) => {
          settings.schemaVersion = 12;
        });
    });

    // ---- v13 ------------------------------------------------------------
    // New equipmentProfiles store; settings gained an optional
    // activeEquipmentProfileId. Both additive — existing rows are untouched.
    this.version(13)
      .stores({ equipmentProfiles: 'id, name' })
      .upgrade(async (tx) => {
        await tx
          .table<AppSettings>('settings')
          .toCollection()
          .modify((settings) => {
            settings.schemaVersion = 13;
          });
      });

    // ---- v14 ------------------------------------------------------------
    // Settings gained voiceAnnouncementsEnabled. Backfilled to false so the
    // opt-in stays off for existing users; no training data is touched.
    this.version(14).upgrade(async (tx) => {
      await tx
        .table<AppSettings>('settings')
        .toCollection()
        .modify((settings) => {
          if (typeof settings.voiceAnnouncementsEnabled !== 'boolean') {
            settings.voiceAnnouncementsEnabled = false;
          }
          settings.schemaVersion = 14;
        });
    });

    // ---- v15 ------------------------------------------------------------
    // SessionExercise gained optional rep/duration/plan-exercise snapshots.
    // They are only filled for workouts started from a plan after this version;
    // existing rows keep working through the live view's fallback, so nothing is
    // backfilled — only the recorded schema version is advanced.
    this.version(15).upgrade(async (tx) => {
      await tx
        .table<AppSettings>('settings')
        .toCollection()
        .modify((settings) => {
          settings.schemaVersion = 15;
        });
    });

    // ---- v16 ------------------------------------------------------------
    // New planImports store: a small record of imported training-plan packages,
    // used to warn on a duplicate import. Additive — existing rows are
    // untouched and only the recorded schema version is advanced.
    this.version(16)
      .stores({ planImports: 'id, fingerprint, importedAt' })
      .upgrade(async (tx) => {
        await tx
          .table<AppSettings>('settings')
          .toCollection()
          .modify((settings) => {
            settings.schemaVersion = 16;
          });
      });

    // ---- v17 ------------------------------------------------------------
    // Split system: a new trainingPlans store becomes the parent of the
    // training days (workoutTemplates, which gain planId + position). Every
    // existing day is wrapped into its own single-day plan, losing nothing;
    // sessions and versions still reference the day by templateId.
    this.version(17)
      .stores({
        trainingPlans: 'id, name',
        workoutTemplates: 'id, name, updatedAt, planId, [planId+position]',
      })
      .upgrade(async (tx) => {
        await wrapOrphanTemplatesInPlans(
          tx.table<TrainingPlan, string>('trainingPlans'),
          tx.table<WorkoutTemplate, string>('workoutTemplates'),
        );
        await tx
          .table<AppSettings>('settings')
          .toCollection()
          .modify((settings) => {
            settings.schemaVersion = 17;
          });
      });

    // ---- v18 ------------------------------------------------------------
    // Schedule system: new planSchedules + scheduleEntries stores. Every plan
    // gains a free-rotation schedule built from its days in their existing
    // order, so the suggested rotation is unchanged; rest days and the other
    // modes only ever come from a later user edit.
    this.version(18)
      .stores({
        planSchedules: 'id, planId',
        scheduleEntries: 'id, scheduleId, templateId, [scheduleId+position]',
      })
      .upgrade(async (tx) => {
        await ensureSchedulesForPlans(
          tx.table<TrainingPlan, string>('trainingPlans'),
          tx.table<PlanSchedule, string>('planSchedules'),
        );
        await tx
          .table<AppSettings>('settings')
          .toCollection()
          .modify((settings) => {
            settings.schemaVersion = 18;
          });
      });

    // ---- v19 ------------------------------------------------------------
    // Workout unit library: two new, initially empty stores for reusable units
    // and their exercises. Plan days gain optional source-unit snapshot fields
    // and sessions an optional started-from-unit snapshot; both default to
    // absent, so no data migration is needed for existing rows.
    this.version(19)
      .stores({
        workoutUnitTemplates: 'id, name, archived',
        workoutUnitTemplateExercises:
          'id, unitTemplateId, exerciseId, [unitTemplateId+order]',
      })
      .upgrade(async (tx) => {
        await tx
          .table<AppSettings>('settings')
          .toCollection()
          .modify((settings) => {
            settings.schemaVersion = 19;
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
  keepScreenAwake: true,
  voiceAnnouncementsEnabled: false,
  backupReminderDays: 14,
  schemaVersion: SCHEMA_VERSION,
  createdAt: '',
  updatedAt: '',
};

/**
 * Reads the settings singleton, creating it on first launch.
 * Never throws for a missing row — the app must always come up.
 */
export async function ensureSettings(
  database: TrainingDatabase = db,
): Promise<AppSettings> {
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
