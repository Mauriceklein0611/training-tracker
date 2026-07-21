import type { AnalyticsDataset } from '@/services/analytics';
import {
  buildSetContexts,
  computeAnalytics,
  filterContextsByRange,
} from '@/services/analytics';
import {
  effectiveLoadKg,
  estimatedOneRepMax,
  isCompleted,
  isWorkingSet,
  setVolumeKg,
  ONE_RM_MAX_REPS,
  ONE_RM_MIN_REPS,
} from '@/services/metrics';
import { restDeviationSeconds } from '@/services/rest';
import type { AnalysisContext, BodyWeightEntry, SetWithContext, WeeklyGoals } from '@/types';
import { hasAnyWeeklyGoal } from '@/services/calendar';
import { customRange, dayKey, lastDaysRange, type DateRange } from '@/utils/date';

/**
 * Export tailored for a language model.
 *
 * Unlike the technical backup this file is *self-describing*: it explains the
 * weight conventions and tracking types so a model does not have to guess, and
 * it omits internal UUIDs where names already identify a record unambiguously.
 *
 * It contains exactly what the user selected — nothing more.
 */

export const AI_EXPORT_VERSION = 1;

export type AiExportPeriodKey = 'all' | '30d' | '90d' | 'custom';

const PHASE_LABELS: Record<string, string> = {
  bulk: 'Aufbauphase (Kalorienüberschuss)',
  maintenance: 'Erhaltungsphase',
  cut: 'Diätphase (Kaloriendefizit)',
};

/**
 * Turns the stored context into a self-explaining block, dropping every field
 * the user left empty so the file never suggests information that is not there.
 */
export function buildContextBlock(
  context: AnalysisContext | undefined,
): Record<string, unknown> | undefined {
  if (!context) return undefined;

  const block: Record<string, unknown> = {};
  if (context.goal?.trim()) block.goal = context.goal.trim();
  if (context.trainingDaysPerWeekTarget != null) {
    block.targetTrainingDaysPerWeek = context.trainingDaysPerWeekTarget;
  }
  if (context.equipment?.trim()) block.availableEquipment = context.equipment.trim();
  if (context.phase) {
    block.phase = context.phase;
    block.phaseDescription = PHASE_LABELS[context.phase] ?? context.phase;
  }
  if (context.limitations?.trim()) block.limitations = context.limitations.trim();
  if (context.focus?.trim()) block.requestedFocus = context.focus.trim();

  if (Object.keys(block).length === 0) return undefined;

  block.note =
    'Diese Angaben stammen aus der Selbstauskunft des Nutzers und sind keine ' +
    'Messwerte. Sie beeinflussen keine Berechnung in den exportierten Daten.';
  return block;
}

export interface AiExportOptions {
  period: AiExportPeriodKey;
  /** Optional self-reported background; omitted from the file when empty. */
  context?: AnalysisContext;
  /** Optional weekly goals; omitted from the file when none are set. */
  weeklyGoals?: WeeklyGoals;
  customFrom?: string;
  customTo?: string;
  includeNotes: boolean;
  includeBodyWeight: boolean;
  includeWarmupSets: boolean;
}

/**
 * Turns weekly goals into a self-describing block, omitted entirely when no
 * goal is set. Marked clearly as user-chosen targets so a model never mistakes
 * them for measured data or an achievement.
 */
export function buildGoalsBlock(
  goals: WeeklyGoals | undefined,
): Record<string, unknown> | undefined {
  if (!hasAnyWeeklyGoal(goals)) return undefined;

  const block: Record<string, unknown> = {
    note: 'Vom Nutzer selbst gesetzte Wochenziele. Es sind Vorgaben, keine Messwerte.',
  };
  if (goals?.sessionsPerWeek != null) block.sessionsPerWeek = goals.sessionsPerWeek;
  if (goals?.workingSetsPerWeek != null) block.workingSetsPerWeek = goals.workingSetsPerWeek;

  const exerciseGoals = (goals?.exerciseGoals ?? []).filter(
    (goal) => goal.sessionsPerWeek != null || goal.workingSetsPerWeek != null,
  );
  if (exerciseGoals.length > 0) {
    block.exercises = exerciseGoals.map((goal) => ({
      exercise: goal.exerciseNameSnapshot,
      ...(goal.sessionsPerWeek != null ? { sessionsPerWeek: goal.sessionsPerWeek } : {}),
      ...(goal.workingSetsPerWeek != null ? { workingSetsPerWeek: goal.workingSetsPerWeek } : {}),
    }));
  }
  return block;
}

export const DEFAULT_AI_EXPORT_OPTIONS: AiExportOptions = {
  period: 'all',
  includeNotes: true,
  includeBodyWeight: false,
  includeWarmupSets: false,
};

export interface ExportPeriodErrors {
  customFrom?: string;
  customTo?: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates the selected period.
 *
 * A custom period requires both dates. Treating a missing date as "no range"
 * would silently widen the export to the entire history — the opposite of what
 * someone narrowing a range expects, and a privacy problem when the file is
 * shared afterwards.
 */
export function validateExportPeriod(options: AiExportOptions): ExportPeriodErrors {
  if (options.period !== 'custom') return {};

  const errors: ExportPeriodErrors = {};
  const from = options.customFrom?.trim();
  const to = options.customTo?.trim();

  if (!from) errors.customFrom = 'Bitte ein Startdatum wählen.';
  else if (!DATE_PATTERN.test(from)) errors.customFrom = 'Ungültiges Datum.';

  if (!to) errors.customTo = 'Bitte ein Enddatum wählen.';
  else if (!DATE_PATTERN.test(to)) errors.customTo = 'Ungültiges Datum.';

  // String comparison is safe for ISO calendar days and avoids any timezone shift.
  if (!errors.customFrom && !errors.customTo && from && to && from > to) {
    errors.customTo = 'Das Enddatum darf nicht vor dem Startdatum liegen.';
  }

  return errors;
}

export function hasExportPeriodErrors(errors: ExportPeriodErrors): boolean {
  return Object.keys(errors).length > 0;
}

export class InvalidExportPeriodError extends Error {
  constructor(public readonly errors: ExportPeriodErrors) {
    super('Der gewählte Zeitraum ist unvollständig oder ungültig.');
    this.name = 'InvalidExportPeriodError';
  }
}

/**
 * Resolves the selected period into a date range.
 *
 * `null` means "entire history" and is only ever returned for the explicit
 * "all" option. An invalid custom period throws instead of falling back, so an
 * export can never quietly contain more than was asked for.
 *
 * Custom ranges are interpreted as local calendar days (00:00 to 23:59:59 local
 * time), not UTC.
 */
export function resolveExportRange(options: AiExportOptions, now = new Date()): DateRange | null {
  switch (options.period) {
    case '30d':
      return lastDaysRange(30, now);
    case '90d':
      return lastDaysRange(90, now);
    case 'custom': {
      const errors = validateExportPeriod(options);
      if (hasExportPeriodErrors(errors)) throw new InvalidExportPeriodError(errors);
      return customRange(options.customFrom as string, options.customTo as string);
    }
    case 'all':
      return null;
  }
}

const TRACKING_TYPE_EXPLANATIONS: Record<string, string> = {
  weight_reps:
    'Übung mit externem Gewicht und Wiederholungen. Volumen in kg ist aussagekräftig.',
  bodyweight_reps:
    'Körpergewichtsübung mit Wiederholungen. Ein eventuelles Gewicht ist Zusatzgewicht ' +
    'zusätzlich zum Körpergewicht. Kein kg-Volumen berechnen, da das Körpergewicht nicht erfasst wird.',
  assisted_bodyweight_reps:
    'Unterstützte Körpergewichtsübung. Ein eventuelles Gewicht verringert die Last ' +
    '(Gegengewicht/Band). Kein kg-Volumen berechnen.',
  reps_only:
    'Übung ohne sinnvolle Last (z. B. TRX, Mobilität). Nur Wiederholungen auswerten, kein kg-Volumen.',
  duration: 'Zeitbasierte Übung (z. B. Plank). Über Dauer und Satzanzahl auswerten.',
};

const WEIGHT_MODE_EXPLANATIONS: Record<string, string> = {
  per_hand:
    'Das Feld "weightKg" beschreibt das Gewicht je Hand/Seite. Die Gesamtlast ergibt ' +
    'sich aus weightKg * weightMultiplier.',
  total: 'Das Feld "weightKg" ist bereits die Gesamtlast (inkl. Stange bzw. Maschinenstack).',
  added_weight: 'Das Feld "weightKg" ist Zusatzgewicht zum Körpergewicht.',
  assistance: 'Das Feld "weightKg" ist die Unterstützung, die die effektive Last reduziert.',
  none: 'Für diese Übung wird kein Gewicht erfasst.',
};

const SET_TYPE_EXPLANATIONS: Record<string, string> = {
  warmup: 'Aufwärmsatz. Standardmäßig nicht Teil des Arbeitsvolumens.',
  working: 'Regulärer Arbeitssatz.',
  drop: 'Dropsatz direkt im Anschluss an einen Arbeitssatz.',
  failure: 'Satz bis zum Muskelversagen.',
};

export interface AiExportFile {
  exportVersion: number;
  generatedAt: string;
  application: string;
  language: string;
  period: {
    key: AiExportPeriodKey;
    from: string | null;
    to: string | null;
    description: string;
  };
  units: { weight: string; duration: string; dateFormat: string };
  conventions: {
    volume: string;
    oneRepMax: string;
    warmupSetsIncluded: boolean;
    trackingTypes: Record<string, string>;
    weightModes: Record<string, string>;
    setTypes: Record<string, string>;
  };
  /**
   * Optional background supplied by the user (goal, equipment, phase …).
   * Absent when nothing was filled in. Never used for any calculation — it is
   * context for the reader, not data.
   */
  context?: Record<string, unknown>;
  /**
   * Optional weekly goals the user set. Targets, not measurements — absent when
   * no goal is configured.
   */
  goals?: Record<string, unknown>;
  summary: Record<string, unknown>;
  muscleGroups: unknown[];
  weeklyTotals: unknown[];
  restAnalysis: Record<string, unknown>;
  exerciseCatalog: unknown[];
  personalRecords: unknown[];
  workouts: unknown[];
  bodyWeight?: unknown[];
  dataQuality: { notes: string[]; completeness: Record<string, unknown> };
}

function round(value: number | null | undefined, digits = 2): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

/** Marks the sets that established a best value inside the exported window. */
function markRecordSets(contexts: SetWithContext[]): Map<string, string[]> {
  const best = new Map<
    string,
    { load?: { id: string; value: number }; oneRm?: { id: string; value: number }; reps?: { id: string; value: number }; duration?: { id: string; value: number } }
  >();

  for (const { set, sessionExercise } of contexts) {
    if (!isCompleted(set) || !isWorkingSet(set)) continue;
    const key = sessionExercise.exerciseId;
    const entry = best.get(key) ?? {};

    const load = effectiveLoadKg(set, sessionExercise);
    if (load != null && (!entry.load || load > entry.load.value)) {
      entry.load = { id: set.id, value: load };
    }
    const oneRm = estimatedOneRepMax(set, sessionExercise);
    if (oneRm != null && (!entry.oneRm || oneRm > entry.oneRm.value)) {
      entry.oneRm = { id: set.id, value: oneRm };
    }
    if (set.reps != null && (!entry.reps || set.reps > entry.reps.value)) {
      entry.reps = { id: set.id, value: set.reps };
    }
    if (
      set.durationSeconds != null &&
      (!entry.duration || set.durationSeconds > entry.duration.value)
    ) {
      entry.duration = { id: set.id, value: set.durationSeconds };
    }
    best.set(key, entry);
  }

  const marks = new Map<string, string[]>();
  const add = (setId: string, label: string) => {
    marks.set(setId, [...(marks.get(setId) ?? []), label]);
  };
  for (const entry of best.values()) {
    if (entry.load) add(entry.load.id, 'hoechstes_gewicht');
    if (entry.oneRm) add(entry.oneRm.id, 'bestes_geschaetztes_1rm');
    if (entry.reps) add(entry.reps.id, 'meiste_wiederholungen');
    if (entry.duration) add(entry.duration.id, 'laengste_dauer');
  }
  return marks;
}

/**
 * Builds the AI export document.
 *
 * `bodyWeightEntries` and notes are only read when the corresponding option is
 * enabled, which guarantees unselected data never reaches the file.
 */
export function buildAiExport(
  dataset: AnalyticsDataset,
  bodyWeightEntries: BodyWeightEntry[],
  options: AiExportOptions,
  now: Date = new Date(),
): AiExportFile {
  const range = resolveExportRange(options, now);
  const analytics = computeAnalytics(dataset, range, {
    includeWarmup: options.includeWarmupSets,
    now,
  });

  const allContexts = buildSetContexts(dataset);
  const contexts = filterContextsByRange(allContexts, range).filter(
    (context) =>
      isCompleted(context.set) && (options.includeWarmupSets || isWorkingSet(context.set)),
  );

  const recordMarks = markRecordSets(contexts);
  const exercisesById = new Map(dataset.exercises.map((exercise) => [exercise.id, exercise]));

  // ---- workouts ---------------------------------------------------------
  const bySession = new Map<string, SetWithContext[]>();
  for (const context of contexts) {
    const list = bySession.get(context.session.id) ?? [];
    list.push(context);
    bySession.set(context.session.id, list);
  }

  const workouts = [...bySession.values()]
    .map((entries) => {
      const session = entries[0].session;
      const byExercise = new Map<string, SetWithContext[]>();
      for (const context of entries) {
        const list = byExercise.get(context.sessionExercise.id) ?? [];
        list.push(context);
        byExercise.set(context.sessionExercise.id, list);
      }

      const exercises = [...byExercise.values()]
        .sort((a, b) => a[0].sessionExercise.order - b[0].sessionExercise.order)
        .map((exerciseEntries) => {
          const sessionExercise = exerciseEntries[0].sessionExercise;
          const catalogEntry = exercisesById.get(sessionExercise.exerciseId);
          return {
            exercise: sessionExercise.exerciseNameSnapshot,
            muscleGroup: catalogEntry?.primaryMuscleGroup ?? null,
            trackingType: sessionExercise.trackingTypeSnapshot,
            weightMode: sessionExercise.weightModeSnapshot,
            weightMultiplier: sessionExercise.weightMultiplierSnapshot,
            ...(options.includeNotes && sessionExercise.notes
              ? { note: sessionExercise.notes }
              : {}),
            sets: exerciseEntries
              .sort((a, b) => a.set.position - b.set.position)
              .map(({ set }) => ({
                setNumber: set.position + 1,
                setType: set.setType,
                weightKg: round(set.weightKg),
                totalLoadKg: round(effectiveLoadKg(set, sessionExercise)),
                reps: set.reps ?? null,
                durationSeconds: set.durationSeconds ?? null,
                rir: set.rir ?? null,
                rpe: set.rpe ?? null,
                volumeKg: round(setVolumeKg(set, sessionExercise)),
                restTargetSeconds: set.restTargetSeconds || null,
                restActualSeconds: set.restActualSeconds ?? null,
                restDeviationSeconds: restDeviationSeconds(set),
                completedAt: set.completedAt ?? null,
                ...(recordMarks.has(set.id) ? { records: recordMarks.get(set.id) } : {}),
              })),
          };
        });

      const durationMinutes = session.finishedAt
        ? round(
            (new Date(session.finishedAt).getTime() - new Date(session.startedAt).getTime()) /
              60000,
            1,
          )
        : null;

      return {
        date: session.startedAt.slice(0, 10),
        startedAt: session.startedAt,
        finishedAt: session.finishedAt ?? null,
        durationMinutes,
        name: session.name,
        ...(options.includeNotes && session.notes ? { note: session.notes } : {}),
        exercises,
      };
    })
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  // ---- catalog ----------------------------------------------------------
  const usedExerciseIds = new Set(
    contexts.map((context) => context.sessionExercise.exerciseId),
  );
  const exerciseCatalog = dataset.exercises
    .filter((exercise) => usedExerciseIds.has(exercise.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    .map((exercise) => ({
      name: exercise.name,
      primaryMuscleGroup: exercise.primaryMuscleGroup || null,
      secondaryMuscleGroups: exercise.secondaryMuscleGroups,
      equipment: exercise.equipment || null,
      trackingType: exercise.trackingType,
      weightMode: exercise.weightMode,
      weightMultiplier: exercise.weightMultiplier,
      defaultRestSeconds: exercise.defaultRestSeconds,
      ...(options.includeNotes && exercise.notes ? { note: exercise.notes } : {}),
    }));

  // ---- data quality -----------------------------------------------------
  const setsMissingReps = contexts.filter(
    (context) =>
      context.sessionExercise.trackingTypeSnapshot !== 'duration' && context.set.reps == null,
  ).length;
  const setsMissingWeight = contexts.filter(
    (context) =>
      context.sessionExercise.trackingTypeSnapshot === 'weight_reps' &&
      context.set.weightKg == null,
  ).length;
  const setsWithoutRest = contexts.filter(
    (context) => context.set.restActualSeconds == null,
  ).length;

  const notes: string[] = [
    'Alle Werte stammen aus der lokalen Trainingsdokumentation des Nutzers.',
    'Fehlende Werte sind null und dürfen nicht geschätzt oder ersetzt werden.',
    'volumeKg ist nur bei Übungen vom Typ weight_reps gesetzt. Bei allen anderen ' +
      'Typen ist ein kg-Volumen fachlich nicht sinnvoll und daher null.',
  ];
  if (!options.includeWarmupSets) notes.push('Aufwärmsätze wurden bewusst nicht exportiert.');
  if (!options.includeNotes) notes.push('Notizen wurden bewusst nicht exportiert.');
  if (!options.includeBodyWeight) {
    notes.push('Körpergewichtsdaten wurden bewusst nicht exportiert.');
  }
  if (analytics.sessionCount === 0) {
    notes.push('Im gewählten Zeitraum liegen keine abgeschlossenen Trainingseinheiten vor.');
  }

  const file: AiExportFile = {
    exportVersion: AI_EXPORT_VERSION,
    generatedAt: now.toISOString(),
    application: 'training-tracker',
    language: 'de',
    period: {
      key: options.period,
      from: range ? range.from.toISOString() : null,
      to: range ? range.to.toISOString() : null,
      description: describePeriod(options),
    },
    units: { weight: 'kg', duration: 'Sekunden', dateFormat: 'ISO-8601' },
    conventions: {
      volume:
        'volumeKg = Gesamtlast * Wiederholungen. Die Gesamtlast berücksichtigt den ' +
        'weightMultiplier (z. B. 2 Kurzhanteln à 20 kg = 40 kg Gesamtlast).',
      oneRepMax:
        `Geschätztes 1RM nach Epley: Gesamtlast * (1 + Wiederholungen / 30). Nur ein ` +
        `Schätzwert, berechnet für ${ONE_RM_MIN_REPS}–${ONE_RM_MAX_REPS} Wiederholungen ` +
        'und ausschließlich für Übungen mit externem Gewicht.',
      warmupSetsIncluded: options.includeWarmupSets,
      trackingTypes: TRACKING_TYPE_EXPLANATIONS,
      weightModes: WEIGHT_MODE_EXPLANATIONS,
      setTypes: SET_TYPE_EXPLANATIONS,
    },
    // Omitted entirely when the user filled in nothing.
    ...(buildContextBlock(options.context) ? { context: buildContextBlock(options.context) } : {}),
    ...(buildGoalsBlock(options.weeklyGoals) ? { goals: buildGoalsBlock(options.weeklyGoals) } : {}),
    summary: {
      workouts: analytics.sessionCount,
      trainingDays: analytics.trainingDays,
      trainingDaysPerWeek: round(analytics.trainingDaysPerWeek, 2),
      totalDurationMinutes: round(analytics.totalDurationSeconds / 60, 1),
      averageDurationMinutes: round((analytics.averageDurationSeconds ?? 0) / 60, 1),
      workingSets: analytics.workingSetCount,
      totalReps: analytics.totalReps,
      totalVolumeKg: round(analytics.volume.volumeKg),
      addedWeightVolumeKg: round(analytics.volume.addedWeightVolumeKg),
      totalDurationOfTimedSetsSeconds: round(analytics.volume.totalDurationSeconds, 0),
      streakWeeks: analytics.streakWeeks,
      consistency: round(analytics.consistency, 2),
    },
    muscleGroups: analytics.muscleGroups.map((group) => ({
      muscleGroup: group.muscleGroup,
      workingSets: group.directSets,
      indirectSets: group.indirectSets,
      totalReps: group.totalReps,
      volumeKg: round(group.volumeKg),
    })),
    weeklyTotals: analytics.weekly.map((week) => ({
      weekStart: week.week,
      workouts: week.sessions,
      workingSets: week.workingSets,
      totalReps: week.totalReps,
      volumeKg: round(week.volumeKg),
    })),
    restAnalysis: {
      evaluatedSets: analytics.restStatistics.evaluatedSets,
      averageRestSeconds: round(analytics.restStatistics.averageActualSeconds, 1),
      averageTargetRestSeconds: round(analytics.restStatistics.averageTargetSeconds, 1),
      averageDeviationSeconds: round(analytics.restStatistics.averageDeviationSeconds, 1),
      shareOfRestsReachingTarget: round(analytics.restStatistics.targetMetRatio, 3),
      explanation:
        'Positive Abweichung bedeutet längere Pause als geplant, negative Abweichung ' +
        'bedeutet zu kurze Pause.',
    },
    exerciseCatalog,
    personalRecords: analytics.personalRecords.map((record) => ({
      exercise: record.exerciseName,
      trackingType: record.trackingType,
      bestTotalLoadKg: round(record.bestLoadKg),
      bestTotalLoadReps: record.bestLoadReps,
      bestTotalLoadAt: record.bestLoadAt,
      bestEstimatedOneRepMaxKg: round(record.bestEstimatedOneRepMax),
      bestReps: record.bestReps,
      bestDurationSeconds: record.bestDurationSeconds,
      bestSessionVolumeKg: round(record.bestSessionVolumeKg),
    })),
    workouts,
    dataQuality: {
      notes,
      completeness: {
        exportedSets: contexts.length,
        setsWithoutRepetitions: setsMissingReps,
        setsWithoutWeightAlthoughWeighted: setsMissingWeight,
        setsWithoutRecordedRest: setsWithoutRest,
        setsWithoutComputableVolume: analytics.volume.setsWithoutVolume,
      },
    },
  };

  if (options.includeBodyWeight) {
    const entries = bodyWeightEntries
      .filter((entry) => {
        if (!range) return true;
        const time = new Date(`${entry.date}T12:00:00`).getTime();
        return time >= range.from.getTime() && time <= range.to.getTime();
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((entry) => ({
        date: entry.date,
        weightKg: entry.weightKg ?? null,
        bodyFatPercent: entry.bodyFatPercent ?? null,
        // Only the circumferences that were actually measured; the rest stays
        // absent rather than being exported as a guessed zero.
        ...(entry.measurements && Object.keys(entry.measurements).length > 0
          ? { measurementsCm: entry.measurements }
          : {}),
        ...(options.includeNotes && entry.notes ? { note: entry.notes } : {}),
      }));
    file.bodyWeight = entries;
    file.dataQuality.notes.push(
      'bodyWeight enthält Körperdaten: Gewicht, Körperfettanteil und gemessene ' +
        'Umfänge in Zentimetern. Fehlende Werte sind null bzw. nicht enthalten und ' +
        'dürfen nicht interpoliert werden.',
    );
  }

  return file;
}

function describePeriod(options: AiExportOptions): string {
  switch (options.period) {
    case 'all':
      return 'Gesamte aufgezeichnete Historie';
    case '30d':
      return 'Letzte 30 Tage';
    case '90d':
      return 'Letzte 90 Tage';
    case 'custom':
      return `Benutzerdefiniert: ${options.customFrom ?? '?'} bis ${options.customTo ?? '?'}`;
  }
}

/** `training-ai-export-2026-07-21.json` */
export function aiExportFileName(date: Date = new Date()): string {
  return `training-ai-export-${dayKey(date)}.json`;
}

/** Ready-to-paste instruction that accompanies the export file. */
export const AI_ANALYSIS_PROMPT = `Analysiere meine Trainingsdaten. Untersuche Trainingshäufigkeit, Progression je Übung, wöchentliches Volumen je Muskelgruppe, Pauseneinhaltung, mögliche Plateaus und auffällige Leistungseinbrüche. Unterscheide gewichtete Übungen, Körpergewichtsübungen, TRX-Übungen und zeitbasierte Übungen. Erfinde keine fehlenden Werte. Bewerte Übungen ohne Gewicht nicht anhand eines fiktiven Kilogrammvolumens. Gib konkrete Empfehlungen für die nächsten vier Wochen und kennzeichne Unsicherheiten aufgrund unvollständiger Daten.`;
