import type { AnalyticsDataset } from '@/services/analytics';
import { buildSetContexts } from '@/services/analytics';
import { setVolumeKg } from '@/services/metrics';
import { effectiveSetExecution, equipmentLabel } from '@/services/equipment';
import { restDeviationSeconds } from '@/services/rest';
import type { BodyWeightEntry, Exercise } from '@/types';
import { BODY_MEASUREMENT_FIELDS } from '@/utils/format';

/**
 * CSV export.
 *
 * Files are UTF-8 with a BOM so that Excel on Windows opens umlauts correctly,
 * and use CRLF line endings as required by RFC 4180.
 */

const SEPARATOR = ',';
const NEWLINE = '\r\n';
export const UTF8_BOM = '﻿';

/**
 * Escapes one CSV field.
 *
 * Fields containing a separator, quote, newline or leading/trailing whitespace
 * are wrapped in double quotes; embedded quotes are doubled.
 */
export function escapeCsvValue(value: unknown): string {
  if (value == null) return '';
  const text = typeof value === 'string' ? value : String(value);
  const needsQuoting =
    text.includes(SEPARATOR) ||
    text.includes('"') ||
    text.includes('\n') ||
    text.includes('\r') ||
    text.trim() !== text;
  if (!needsQuoting) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCsvValue).join(SEPARATOR)];
  for (const row of rows) {
    lines.push(row.map(escapeCsvValue).join(SEPARATOR));
  }
  return UTF8_BOM + lines.join(NEWLINE) + NEWLINE;
}

/** Formats a number with a dot decimal separator, or an empty cell for null. */
function num(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '';
  return Number(value.toFixed(digits)).toString();
}

const TRACKING_TYPE_LABELS: Record<string, string> = {
  weight_reps: 'Gewicht + Wiederholungen',
  bodyweight_reps: 'Körpergewicht + Wiederholungen',
  assisted_bodyweight_reps: 'Unterstützt + Wiederholungen',
  reps_only: 'Nur Wiederholungen',
  duration: 'Zeit',
};

const WEIGHT_MODE_LABELS: Record<string, string> = {
  per_hand: 'je Hand',
  total: 'gesamt',
  added_weight: 'Zusatzgewicht',
  assistance: 'Unterstützung',
  none: 'kein Gewicht',
};

const SET_TYPE_LABELS: Record<string, string> = {
  warmup: 'Aufwärmsatz',
  working: 'Arbeitssatz',
  drop: 'Dropsatz',
  failure: 'Satz bis Muskelversagen',
};

const SCHEDULE_MODE_LABELS: Record<string, string> = {
  'free-rotation': 'Freie Rotation',
  'repeating-cycle': 'Wiederholender Zyklus',
  weekly: 'Wochenplan',
};

export function sessionsCsv(dataset: AnalyticsDataset): string {
  // New context columns are appended, never inserted, so the header order stays
  // stable for anyone parsing an older export.
  const headers = [
    'Datum',
    'Beginn',
    'Ende',
    'Training',
    'Status',
    'Dauer (min)',
    'Notiz',
    'Trainingsplan',
    'Übungseinheit',
    'Deload',
    'Geplantes Datum',
    'Zeitplanmodus',
  ];
  const rows = [...dataset.sessions]
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((session) => {
      const duration = session.finishedAt
        ? (new Date(session.finishedAt).getTime() -
            new Date(session.startedAt).getTime()) /
          60000
        : null;
      return [
        session.startedAt.slice(0, 10),
        session.startedAt,
        session.finishedAt ?? '',
        session.name,
        session.status === 'completed' ? 'abgeschlossen' : 'aktiv',
        num(duration, 1),
        session.notes,
        session.planNameSnapshot ?? '',
        session.workoutUnitNameSnapshot ?? '',
        session.deloadIntensity ? 'ja' : 'nein',
        session.plannedDate ?? '',
        session.scheduleModeSnapshot
          ? (SCHEDULE_MODE_LABELS[session.scheduleModeSnapshot] ??
            session.scheduleModeSnapshot)
          : '',
      ];
    });
  return toCsv(headers, rows);
}

export function setsCsv(dataset: AnalyticsDataset): string {
  const headers = [
    'Datum',
    'Training',
    'Übung',
    'Muskelgruppe',
    'Equipment',
    'Tracking-Typ',
    'Satznummer',
    'Satzart',
    'Gewicht',
    'Gewichtskonvention',
    'Gewichtsmultiplikator',
    'Wiederholungen',
    'Dauer (s)',
    'RIR',
    'RPE',
    'Zielpause (s)',
    'Tatsächliche Pause (s)',
    'Pausenabweichung (s)',
    'Volumen (kg)',
    'Notiz',
    // Appended context columns (Phase 9).
    'Trainingsplan',
    'Deload',
    // Structured per-set equipment (Feature 3); appended so the header stays stable.
    'Ausrüstung',
  ];

  const exercisesById = new Map(
    dataset.exercises.map((exercise) => [exercise.id, exercise]),
  );
  const contexts = buildSetContexts(dataset, { includeActiveSession: true }).sort(
    (a, b) =>
      a.session.startedAt.localeCompare(b.session.startedAt) ||
      a.sessionExercise.order - b.sessionExercise.order ||
      a.set.position - b.set.position,
  );

  const rows = contexts.map(({ set, sessionExercise, session }) => {
    const exercise = exercisesById.get(sessionExercise.exerciseId);
    // The set's actually-performed execution (per-set snapshot → session-exercise
    // snapshot). Identical to the old columns for history without per-set data.
    const execution = effectiveSetExecution(set, sessionExercise);
    return [
      session.startedAt.slice(0, 10),
      session.name,
      sessionExercise.exerciseNameSnapshot,
      exercise?.primaryMuscleGroup ?? '',
      exercise?.equipment ?? '',
      TRACKING_TYPE_LABELS[execution.trackingType] ?? execution.trackingType,
      set.position + 1,
      SET_TYPE_LABELS[set.setType] ?? set.setType,
      num(set.weightKg),
      WEIGHT_MODE_LABELS[execution.weightMode] ?? execution.weightMode,
      num(execution.weightMultiplier, 2),
      set.reps ?? '',
      num(set.durationSeconds, 0),
      num(set.rir, 1),
      num(set.rpe, 1),
      set.restTargetSeconds,
      num(set.restActualSeconds, 0),
      num(restDeviationSeconds(set), 0),
      num(setVolumeKg(set, sessionExercise)),
      sessionExercise.notes,
      session.planNameSnapshot ?? '',
      session.deloadIntensity ? 'ja' : 'nein',
      // Empty for unspecified so old rows stay blank rather than saying "Nicht festgelegt".
      execution.equipment === 'unspecified' ? '' : equipmentLabel(execution.equipment),
    ];
  });

  return toCsv(headers, rows);
}

export function exercisesCsv(exercises: Exercise[]): string {
  const headers = [
    'Name',
    'Primäre Muskelgruppe',
    'Sekundäre Muskelgruppen',
    'Equipment',
    'Tracking-Typ',
    'Gewichtskonvention',
    'Gewichtsmultiplikator',
    'Standardpause (s)',
    'Archiviert',
    'Notiz',
    'Herkunft',
  ];
  const rows = [...exercises]
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    .map((exercise) => [
      exercise.name,
      exercise.primaryMuscleGroup,
      exercise.secondaryMuscleGroups.join('; '),
      exercise.equipment,
      TRACKING_TYPE_LABELS[exercise.trackingType] ?? exercise.trackingType,
      WEIGHT_MODE_LABELS[exercise.weightMode] ?? exercise.weightMode,
      num(exercise.weightMultiplier, 2),
      exercise.defaultRestSeconds,
      exercise.archived ? 'ja' : 'nein',
      exercise.notes,
      exercise.origin === 'system' ? 'System' : 'Eigene',
    ]);
  return toCsv(headers, rows);
}

export function bodyWeightCsv(entries: BodyWeightEntry[]): string {
  const headers = [
    'Datum',
    'Gewicht (kg)',
    'Körperfett (%)',
    ...BODY_MEASUREMENT_FIELDS.map((field) => `${field.label} (cm)`),
    'Notiz',
  ];
  const rows = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) => [
      entry.date,
      num(entry.weightKg, 2),
      num(entry.bodyFatPercent, 1),
      ...BODY_MEASUREMENT_FIELDS.map((field) => num(entry.measurements?.[field.key], 1)),
      entry.notes,
    ]);
  return toCsv(headers, rows);
}
