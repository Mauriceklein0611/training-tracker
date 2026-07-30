import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage } from '@/i18n';
import type { AnalyticsDataset } from '@/services/analytics';
import { buildAiExport, DEFAULT_AI_EXPORT_OPTIONS } from '@/services/aiExport';
import { bodyWeightCsv, exercisesCsv, sessionsCsv, setsCsv } from '@/services/csv';
import {
  makeExercise,
  makeSession,
  makeSessionExercise,
  makeSet,
} from '@/tests/factories';
import type { BodyWeightEntry } from '@/types';

/**
 * Guard for the #26 change gate: the display language is presentation only.
 *
 * `utils/format` and `utils/date` became locale-aware with #31 (decimal comma vs
 * point, date order, month names). Nothing that leaves the app as a *format*
 * may inherit that — a CSV or AI export produced in English must be byte-for-byte
 * what the German app produces, or every downstream parser and every stored
 * fixture would silently depend on a UI setting.
 */
function dataset(): AnalyticsDataset {
  const exercise = makeExercise({
    id: 'ex-1',
    name: 'Kurzhantel-Rudern',
    primaryMuscleGroup: 'Rücken',
    equipment: 'Kurzhantel',
    weightMode: 'per_hand',
    weightMultiplier: 2,
  });
  const session = makeSession({
    id: 's-1',
    name: 'Zug, Tag 1',
    startedAt: '2026-07-06T10:00:00.000Z',
    finishedAt: '2026-07-06T11:12:00.000Z',
    status: 'completed',
  });
  const sessionExercise = makeSessionExercise({
    id: 'se-1',
    sessionId: 's-1',
    exerciseId: 'ex-1',
    exerciseNameSnapshot: 'Kurzhantel-Rudern',
    weightModeSnapshot: 'per_hand',
    weightMultiplierSnapshot: 2,
  });
  return {
    exercises: [exercise],
    sessions: [session],
    sessionExercises: [sessionExercise],
    // Deliberately a fractional weight: a decimal comma vs point would show up.
    sets: [
      makeSet({
        sessionExerciseId: 'se-1',
        weightKg: 22.5,
        reps: 10,
        restTargetSeconds: 90,
        restActualSeconds: 105,
      }),
    ],
  };
}

const bodyEntries: BodyWeightEntry[] = [
  {
    id: 'bw-1',
    date: '2026-07-06',
    weightKg: 81.4,
    bodyFatPercent: 17.5,
    measurements: { waistCm: 86.5, chestCm: 104.2 },
    notes: 'Morgens, nüchtern',
    createdAt: '2026-07-06T08:00:00.000Z',
    updatedAt: '2026-07-06T08:00:00.000Z',
  },
];

/** Produces every language-sensitive artefact for the active language. */
function artefacts() {
  const data = dataset();
  return {
    sets: setsCsv(data),
    sessions: sessionsCsv(data),
    exercises: exercisesCsv(data.exercises),
    body: bodyWeightCsv(bodyEntries),
    // Fixed export id and clock so only language can differ between runs.
    ai: JSON.stringify(
      buildAiExport(
        data,
        bodyEntries,
        { ...DEFAULT_AI_EXPORT_OPTIONS, exportId: 'fixed-export-id' },
        new Date('2026-07-30T09:00:00.000Z'),
      ),
    ),
  };
}

afterEach(() => setLanguage('de'));

describe('exports are independent of the display language', () => {
  it('produces identical CSV and AI output in German and English', () => {
    setLanguage('de');
    const german = artefacts();
    setLanguage('en');
    const english = artefacts();

    expect(english.sets).toBe(german.sets);
    expect(english.sessions).toBe(german.sessions);
    expect(english.exercises).toBe(german.exercises);
    expect(english.body).toBe(german.body);
    expect(english.ai).toBe(german.ai);
  });

  it('writes machine-readable CSV numbers in both languages', () => {
    // The CSV contract formats numbers itself (`Number(...toFixed())`), so a
    // decimal point is emitted regardless of the UI locale — never a German
    // comma that a parser would read as a column separator.
    for (const language of ['de', 'en'] as const) {
      setLanguage(language);
      const { sets, body } = artefacts();
      expect(sets).toContain('22.5');
      expect(sets).not.toContain('22,5');
      expect(body).toContain('81.4');
      expect(body).not.toContain('81,4');
    }
  });

  it('keeps the body-measurement CSV header canonical in both languages', () => {
    setLanguage('de');
    const germanHeader = artefacts().body.split('\r\n')[0];
    setLanguage('en');
    expect(artefacts().body.split('\r\n')[0]).toBe(germanHeader);
    expect(germanHeader).toContain('Taille (cm)');
  });
});
