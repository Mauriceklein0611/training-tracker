import { describe, expect, it } from 'vitest';
import {
  bodyWeightCsv,
  escapeCsvValue,
  exercisesCsv,
  sessionsCsv,
  setsCsv,
  toCsv,
  UTF8_BOM,
} from '@/services/csv';
import type { AnalyticsDataset } from '@/services/analytics';
import {
  makeExercise,
  makeSession,
  makeSessionExercise,
  makeSet,
} from '@/tests/factories';

describe('escapeCsvValue', () => {
  it('leaves harmless values untouched', () => {
    expect(escapeCsvValue('Bankdrücken')).toBe('Bankdrücken');
    expect(escapeCsvValue(42)).toBe('42');
  });

  it('quotes values containing the separator', () => {
    expect(escapeCsvValue('Brust, Trizeps')).toBe('"Brust, Trizeps"');
  });

  it('doubles embedded quotes', () => {
    expect(escapeCsvValue('Griff "eng"')).toBe('"Griff ""eng"""');
  });

  it('quotes values containing newlines', () => {
    expect(escapeCsvValue('Zeile 1\nZeile 2')).toBe('"Zeile 1\nZeile 2"');
    expect(escapeCsvValue('Zeile 1\r\nZeile 2')).toBe('"Zeile 1\r\nZeile 2"');
  });

  it('quotes values with surrounding whitespace so it is preserved', () => {
    expect(escapeCsvValue('  Notiz  ')).toBe('"  Notiz  "');
  });

  it('renders null and undefined as empty cells', () => {
    expect(escapeCsvValue(null)).toBe('');
    expect(escapeCsvValue(undefined)).toBe('');
  });
});

describe('toCsv', () => {
  it('writes a BOM, a header row and CRLF line endings', () => {
    const csv = toCsv(['A', 'B'], [[1, 'x']]);
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    expect(csv).toContain('A,B\r\n1,x');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('escapes cells inside the rows', () => {
    expect(toCsv(['A'], [['a,b']])).toContain('"a,b"');
  });
});

function buildDataset(): AnalyticsDataset {
  const exercise = makeExercise({
    id: 'ex-1',
    name: 'Kurzhantel-Rudern',
    primaryMuscleGroup: 'Rücken',
    equipment: 'Kurzhantel',
    weightMode: 'per_hand',
    weightMultiplier: 2,
  });
  const session = makeSession({ id: 's-1', name: 'Zug, Tag 1' });
  const sessionExercise = makeSessionExercise({
    id: 'se-1',
    sessionId: 's-1',
    exerciseId: 'ex-1',
    exerciseNameSnapshot: 'Kurzhantel-Rudern',
    weightModeSnapshot: 'per_hand',
    weightMultiplierSnapshot: 2,
    notes: 'Rücken "flach" halten',
  });
  return {
    exercises: [exercise],
    sessions: [session],
    sessionExercises: [sessionExercise],
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

describe('setsCsv', () => {
  it('includes all required columns', () => {
    const csv = setsCsv(buildDataset());
    const header = csv.replace(UTF8_BOM, '').split('\r\n')[0];

    for (const column of [
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
      'Volumen (kg)',
      'Notiz',
    ]) {
      expect(header).toContain(column);
    }
  });

  it('writes the computed volume using the weight multiplier', () => {
    const row = setsCsv(buildDataset()).split('\r\n')[1];
    // 22.5 kg per hand × 2 × 10 reps = 450 kg
    expect(row).toContain('450');
    expect(row).toContain('je Hand');
  });

  it('escapes a session name and a note containing separators and quotes', () => {
    const row = setsCsv(buildDataset()).split('\r\n')[1];
    expect(row).toContain('"Zug, Tag 1"');
    expect(row).toContain('"Rücken ""flach"" halten"');
  });

  it('records the rest deviation', () => {
    const row = setsCsv(buildDataset()).split('\r\n')[1];
    expect(row.split(',')).toContain('15');
  });
});

describe('other CSV exports', () => {
  it('exports sessions with a duration in minutes', () => {
    const csv = sessionsCsv(buildDataset());
    expect(csv).toContain('60'); // factory sessions last one hour
    expect(csv).toContain('abgeschlossen');
  });

  it('exports exercises with their conventions', () => {
    const csv = exercisesCsv(buildDataset().exercises);
    expect(csv).toContain('Kurzhantel-Rudern');
    expect(csv).toContain('je Hand');
  });

  it('exports body data sorted by date', () => {
    const csv = bodyWeightCsv([
      {
        id: 'b2',
        date: '2026-07-02',
        weightKg: 80.5,
        notes: '',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'b1',
        date: '2026-07-01',
        weightKg: 81,
        notes: 'morgens',
        createdAt: '',
        updatedAt: '',
      },
    ]);
    const rows = csv.replace(UTF8_BOM, '').trim().split('\r\n');
    expect(rows[1]).toContain('2026-07-01');
    expect(rows[2]).toContain('2026-07-02');
  });

  it('exports body fat and every circumference column', () => {
    const csv = bodyWeightCsv([
      {
        id: 'b1',
        date: '2026-07-01',
        weightKg: 80,
        bodyFatPercent: 17.5,
        measurements: { waistCm: 84, bicepsLeftCm: 38.5 },
        notes: '',
        createdAt: '',
        updatedAt: '',
      },
    ]);
    const [header, row] = csv.replace(UTF8_BOM, '').trim().split('\r\n');

    expect(header).toContain('Körperfett (%)');
    expect(header).toContain('Taille (cm)');
    expect(header).toContain('Bizeps links (cm)');

    const cells = row.split(',');
    expect(cells).toContain('17.5');
    expect(cells).toContain('84');
    expect(cells).toContain('38.5');
  });

  it('leaves unmeasured circumferences as empty cells', () => {
    const csv = bodyWeightCsv([
      {
        id: 'b1',
        date: '2026-07-01',
        measurements: { waistCm: 84 },
        notes: '',
        createdAt: '',
        updatedAt: '',
      },
    ]);
    const [header, row] = csv.replace(UTF8_BOM, '').trim().split('\r\n');

    // Same number of columns, but nothing invented for what was not measured.
    expect(row.split(',')).toHaveLength(header.split(',').length);
    expect(row.split(',').filter((cell) => cell === '').length).toBeGreaterThan(10);
  });
});
