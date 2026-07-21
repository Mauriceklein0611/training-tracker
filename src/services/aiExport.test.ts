import { describe, expect, it } from 'vitest';
import {
  AI_ANALYSIS_PROMPT,
  aiExportFileName,
  buildAiExport,
  DEFAULT_AI_EXPORT_OPTIONS,
  hasExportPeriodErrors,
  InvalidExportPeriodError,
  resolveExportRange,
  validateExportPeriod,
} from '@/services/aiExport';
import type { AnalyticsDataset } from '@/services/analytics';
import type { AnalysisContext, BodyWeightEntry } from '@/types';
import { makeExercise, makeSession, makeSessionExercise, makeSet } from '@/tests/factories';

const NOW = new Date('2026-07-21T12:00:00.000Z');

function buildDataset(): AnalyticsDataset {
  const bench = makeExercise({ id: 'ex-bench', name: 'Bankdrücken', primaryMuscleGroup: 'Brust' });
  const plank = makeExercise({
    id: 'ex-plank',
    name: 'Plank',
    primaryMuscleGroup: 'Rumpf',
    trackingType: 'duration',
    weightMode: 'none',
  });

  const recent = makeSession({
    id: 's-recent',
    name: 'Oberkörper',
    startedAt: '2026-07-20T10:00:00.000Z',
    notes: 'Gut geschlafen',
  });
  const old = makeSession({ id: 's-old', startedAt: '2026-01-10T10:00:00.000Z' });

  return {
    exercises: [bench, plank],
    sessions: [recent, old],
    sessionExercises: [
      makeSessionExercise({ id: 'se-1', sessionId: 's-recent', exerciseId: 'ex-bench' }),
      makeSessionExercise({
        id: 'se-2',
        sessionId: 's-recent',
        exerciseId: 'ex-plank',
        order: 1,
        exerciseNameSnapshot: 'Plank',
        trackingTypeSnapshot: 'duration',
        weightModeSnapshot: 'none',
      }),
      makeSessionExercise({ id: 'se-3', sessionId: 's-old', exerciseId: 'ex-bench' }),
    ],
    sets: [
      makeSet({
        sessionExerciseId: 'se-1',
        weightKg: 80,
        reps: 8,
        completedAt: '2026-07-20T10:05:00.000Z',
        restTargetSeconds: 120,
        restActualSeconds: 130,
      }),
      makeSet({
        sessionExerciseId: 'se-1',
        position: 1,
        setType: 'warmup',
        weightKg: 40,
        reps: 10,
        completedAt: '2026-07-20T10:01:00.000Z',
      }),
      makeSet({
        sessionExerciseId: 'se-2',
        weightKg: undefined,
        reps: undefined,
        durationSeconds: 60,
        completedAt: '2026-07-20T10:20:00.000Z',
      }),
      makeSet({
        sessionExerciseId: 'se-3',
        weightKg: 70,
        reps: 8,
        completedAt: '2026-01-10T10:05:00.000Z',
      }),
    ],
  };
}

const BODY_WEIGHT: BodyWeightEntry[] = [
  {
    id: 'bw-1',
    date: '2026-07-19',
    weightKg: 80,
    bodyFatPercent: 17.5,
    measurements: { waistCm: 84, chestCm: 102 },
    notes: 'morgens',
    createdAt: '',
    updatedAt: '',
  },
];

describe('resolveExportRange', () => {
  it('returns no range for the full history', () => {
    expect(resolveExportRange({ ...DEFAULT_AI_EXPORT_OPTIONS, period: 'all' }, NOW)).toBeNull();
  });

  it('builds the last 30 and 90 day windows', () => {
    expect(resolveExportRange({ ...DEFAULT_AI_EXPORT_OPTIONS, period: '30d' }, NOW)).not.toBeNull();
    expect(resolveExportRange({ ...DEFAULT_AI_EXPORT_OPTIONS, period: '90d' }, NOW)).not.toBeNull();
  });

  it('refuses an incomplete custom range instead of exporting everything', () => {
    // The dangerous case: a missing date must never silently widen the export.
    expect(() =>
      resolveExportRange({ ...DEFAULT_AI_EXPORT_OPTIONS, period: 'custom' }, NOW),
    ).toThrow(InvalidExportPeriodError);
  });

  it('resolves a valid custom range as local calendar days', () => {
    const range = resolveExportRange(
      {
        ...DEFAULT_AI_EXPORT_OPTIONS,
        period: 'custom',
        customFrom: '2026-07-01',
        customTo: '2026-07-31',
      },
      NOW,
    );

    expect(range).not.toBeNull();
    // Local midnight to local end of day, not a UTC boundary.
    expect(range!.from.getHours()).toBe(0);
    expect(range!.from.getDate()).toBe(1);
    expect(range!.to.getHours()).toBe(23);
    expect(range!.to.getDate()).toBe(31);
  });
});

describe('validateExportPeriod', () => {
  const custom = (customFrom?: string, customTo?: string) => ({
    ...DEFAULT_AI_EXPORT_OPTIONS,
    period: 'custom' as const,
    customFrom,
    customTo,
  });

  it('accepts a complete, ordered range', () => {
    const errors = validateExportPeriod(custom('2026-07-01', '2026-07-31'));
    expect(hasExportPeriodErrors(errors)).toBe(false);
  });

  it('accepts a single-day range', () => {
    expect(
      hasExportPeriodErrors(validateExportPeriod(custom('2026-07-15', '2026-07-15'))),
    ).toBe(false);
  });

  it('reports a missing start date', () => {
    const errors = validateExportPeriod(custom(undefined, '2026-07-31'));
    expect(errors.customFrom).toContain('Startdatum');
    expect(errors.customTo).toBeUndefined();
  });

  it('reports a missing end date', () => {
    const errors = validateExportPeriod(custom('2026-07-01', undefined));
    expect(errors.customTo).toContain('Enddatum');
    expect(errors.customFrom).toBeUndefined();
  });

  it('reports both dates when neither was given', () => {
    const errors = validateExportPeriod(custom());
    expect(errors.customFrom).toBeTruthy();
    expect(errors.customTo).toBeTruthy();
  });

  it('reports a reversed range', () => {
    const errors = validateExportPeriod(custom('2026-07-31', '2026-07-01'));
    expect(errors.customTo).toContain('vor dem Startdatum');
  });

  it('rejects a malformed date', () => {
    expect(validateExportPeriod(custom('01.07.2026', '2026-07-31')).customFrom).toContain(
      'Ungültig',
    );
  });

  it('ignores empty strings the same way as missing values', () => {
    const errors = validateExportPeriod(custom('', '   '));
    expect(errors.customFrom).toBeTruthy();
    expect(errors.customTo).toBeTruthy();
  });

  it('has nothing to complain about for the preset periods', () => {
    for (const period of ['all', '30d', '90d'] as const) {
      expect(
        hasExportPeriodErrors(validateExportPeriod({ ...DEFAULT_AI_EXPORT_OPTIONS, period })),
      ).toBe(false);
    }
  });
});

describe('buildAiExport', () => {
  it('is self-describing: units, conventions and tracking types are explained', () => {
    const file = buildAiExport(buildDataset(), [], DEFAULT_AI_EXPORT_OPTIONS, NOW);

    expect(file.exportVersion).toBe(1);
    expect(file.generatedAt).toBe(NOW.toISOString());
    expect(file.units.weight).toBe('kg');
    expect(file.conventions.trackingTypes.weight_reps).toContain('Volumen');
    expect(file.conventions.weightModes.per_hand).toContain('weightMultiplier');
    expect(file.conventions.oneRepMax).toContain('Epley');
  });

  it('omits the goals block when no weekly goal is set', () => {
    const file = buildAiExport(buildDataset(), [], DEFAULT_AI_EXPORT_OPTIONS, NOW);
    expect(file.goals).toBeUndefined();
  });

  it('includes weekly goals as clearly-labelled targets when set', () => {
    const file = buildAiExport(
      buildDataset(),
      [],
      {
        ...DEFAULT_AI_EXPORT_OPTIONS,
        weeklyGoals: {
          sessionsPerWeek: 4,
          exerciseGoals: [
            { exerciseId: 'e1', exerciseNameSnapshot: 'Kniebeuge', workingSetsPerWeek: 9 },
          ],
        },
      },
      NOW,
    );

    expect(file.goals?.sessionsPerWeek).toBe(4);
    expect(String(file.goals?.note)).toContain('keine Messwerte');
    expect(JSON.stringify(file.goals)).toContain('Kniebeuge');
  });

  it('contains no internal database identifiers', () => {
    const file = buildAiExport(buildDataset(), [], DEFAULT_AI_EXPORT_OPTIONS, NOW);
    const serialised = JSON.stringify(file);

    expect(serialised).not.toContain('se-1');
    expect(serialised).not.toContain('s-recent');
    expect(serialised).not.toContain('sessionExerciseId');
    // Exercises are identified by name instead.
    expect(serialised).toContain('Bankdrücken');
  });

  it('excludes warm-up sets by default', () => {
    const file = buildAiExport(buildDataset(), [], DEFAULT_AI_EXPORT_OPTIONS, NOW);

    // The set-type glossary always lists "warmup"; what matters is that no
    // warm-up set made it into the workout data.
    expect(JSON.stringify(file.workouts)).not.toContain('warmup');
    expect(file.conventions.warmupSetsIncluded).toBe(false);
    expect(file.dataQuality.completeness.exportedSets).toBe(3);
  });

  it('includes warm-up sets when the option is enabled', () => {
    const file = buildAiExport(
      buildDataset(),
      [],
      { ...DEFAULT_AI_EXPORT_OPTIONS, includeWarmupSets: true },
      NOW,
    );
    expect(JSON.stringify(file.workouts)).toContain('warmup');
    expect(file.dataQuality.completeness.exportedSets).toBe(4);
  });

  it('omits notes unless they were selected', () => {
    const without = buildAiExport(
      buildDataset(),
      [],
      { ...DEFAULT_AI_EXPORT_OPTIONS, includeNotes: false },
      NOW,
    );
    expect(JSON.stringify(without)).not.toContain('Gut geschlafen');

    const with_ = buildAiExport(buildDataset(), [], DEFAULT_AI_EXPORT_OPTIONS, NOW);
    expect(JSON.stringify(with_)).toContain('Gut geschlafen');
  });

  it('omits body data unless it was selected', () => {
    const without = buildAiExport(buildDataset(), BODY_WEIGHT, DEFAULT_AI_EXPORT_OPTIONS, NOW);
    expect(without.bodyWeight).toBeUndefined();
    // Not even the measurements may leak into an unselected export.
    expect(JSON.stringify(without)).not.toContain('waistCm');

    const with_ = buildAiExport(
      buildDataset(),
      BODY_WEIGHT,
      { ...DEFAULT_AI_EXPORT_OPTIONS, includeBodyWeight: true },
      NOW,
    );
    expect(with_.bodyWeight).toHaveLength(1);
  });

  it('exports weight, body fat and measurements together', () => {
    const file = buildAiExport(
      buildDataset(),
      BODY_WEIGHT,
      { ...DEFAULT_AI_EXPORT_OPTIONS, includeBodyWeight: true },
      NOW,
    );
    const [entry] = file.bodyWeight as {
      weightKg: number | null;
      bodyFatPercent: number | null;
      measurementsCm?: Record<string, number>;
    }[];

    expect(entry.weightKg).toBe(80);
    expect(entry.bodyFatPercent).toBe(17.5);
    expect(entry.measurementsCm?.waistCm).toBe(84);
    // The unit convention is spelled out for the model.
    expect(file.dataQuality.notes.join(' ')).toContain('Zentimetern');
  });

  it('omits the measurement block when nothing was measured', () => {
    const file = buildAiExport(
      buildDataset(),
      [{ id: 'bw-2', date: '2026-07-19', weightKg: 80, notes: '', createdAt: '', updatedAt: '' }],
      { ...DEFAULT_AI_EXPORT_OPTIONS, includeBodyWeight: true },
      NOW,
    );
    const [entry] = file.bodyWeight as { measurementsCm?: unknown }[];
    expect(entry.measurementsCm).toBeUndefined();
  });

  it('honours the selected period', () => {
    const all = buildAiExport(buildDataset(), [], DEFAULT_AI_EXPORT_OPTIONS, NOW);
    expect(all.workouts).toHaveLength(2);

    const recent = buildAiExport(
      buildDataset(),
      [],
      { ...DEFAULT_AI_EXPORT_OPTIONS, period: '30d' },
      NOW,
    );
    expect(recent.workouts).toHaveLength(1);
    expect(recent.period.description).toBe('Letzte 30 Tage');
  });

  it('sets volumeKg only where it is meaningful', () => {
    const file = buildAiExport(buildDataset(), [], DEFAULT_AI_EXPORT_OPTIONS, NOW);
    const workout = file.workouts.find(
      (entry) => (entry as { date: string }).date === '2026-07-20',
    ) as { exercises: { exercise: string; sets: { volumeKg: number | null }[] }[] };

    const bench = workout.exercises.find((entry) => entry.exercise === 'Bankdrücken');
    const plank = workout.exercises.find((entry) => entry.exercise === 'Plank');

    expect(bench?.sets[0].volumeKg).toBe(640);
    // A timed exercise must never be given an invented kilogram volume.
    expect(plank?.sets[0].volumeKg).toBeNull();
  });

  it('marks the sets that established a personal best', () => {
    const file = buildAiExport(buildDataset(), [], DEFAULT_AI_EXPORT_OPTIONS, NOW);
    const serialised = JSON.stringify(file);
    expect(serialised).toContain('hoechstes_gewicht');
  });

  it('reports data quality instead of hiding gaps', () => {
    const file = buildAiExport(buildDataset(), [], DEFAULT_AI_EXPORT_OPTIONS, NOW);
    expect(file.dataQuality.completeness.exportedSets).toBe(3);
    expect(file.dataQuality.notes.join(' ')).toContain('null');
    expect(file.dataQuality.notes.join(' ')).toContain('Aufwärmsätze');
  });

  it('summarises rest behaviour with an explanation', () => {
    const file = buildAiExport(buildDataset(), [], DEFAULT_AI_EXPORT_OPTIONS, NOW);
    expect(file.restAnalysis.averageDeviationSeconds).toBe(10);
    expect(String(file.restAnalysis.explanation)).toContain('Abweichung');
  });

  it('survives an empty database', () => {
    const file = buildAiExport(
      { sessions: [], sessionExercises: [], sets: [], exercises: [] },
      [],
      DEFAULT_AI_EXPORT_OPTIONS,
      NOW,
    );
    expect(file.workouts).toEqual([]);
    expect(file.dataQuality.notes.join(' ')).toContain('keine abgeschlossenen');
  });

  it('serialises to valid JSON with ISO timestamps', () => {
    const file = buildAiExport(buildDataset(), [], DEFAULT_AI_EXPORT_OPTIONS, NOW);
    const roundTripped = JSON.parse(JSON.stringify(file));
    expect(roundTripped.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('analysis context', () => {
  const withContext = (context: AnalysisContext | undefined) =>
    buildAiExport(buildDataset(), [], { ...DEFAULT_AI_EXPORT_OPTIONS, context }, NOW);

  it('omits the block entirely when nothing was filled in', () => {
    expect(withContext(undefined).context).toBeUndefined();
    expect(withContext({}).context).toBeUndefined();
    // Whitespace is not information either.
    expect(withContext({ goal: '   ' }).context).toBeUndefined();
  });

  it('includes only the fields that were filled in', () => {
    const file = withContext({ goal: 'Kraftaufbau', equipment: 'Langhantel' });

    expect(file.context?.goal).toBe('Kraftaufbau');
    expect(file.context?.availableEquipment).toBe('Langhantel');
    expect(file.context?.limitations).toBeUndefined();
    expect(file.context?.requestedFocus).toBeUndefined();
  });

  it('explains the phase in plain language', () => {
    const file = withContext({ phase: 'cut' });

    expect(file.context?.phase).toBe('cut');
    expect(String(file.context?.phaseDescription)).toContain('Diät');
  });

  it('marks the block as self-reported, not measured', () => {
    const file = withContext({ goal: 'Kraftaufbau' });
    expect(String(file.context?.note)).toContain('Selbstauskunft');
    expect(String(file.context?.note)).toContain('keine Berechnung');
  });

  it('trims surrounding whitespace', () => {
    expect(withContext({ goal: '  Kraftaufbau  ' }).context?.goal).toBe('Kraftaufbau');
  });

  it('does not let the context influence any computed figure', () => {
    const without = buildAiExport(buildDataset(), [], DEFAULT_AI_EXPORT_OPTIONS, NOW);
    const with_ = withContext({ goal: 'Kraftaufbau', trainingDaysPerWeekTarget: 5 });

    expect(with_.summary).toEqual(without.summary);
    expect(with_.workouts).toEqual(without.workouts);
  });
});

describe('export metadata', () => {
  it('names the file with the current date', () => {
    expect(aiExportFileName(NOW)).toBe('training-ai-export-2026-07-21.json');
  });

  it('ships an analysis instruction that forbids inventing values', () => {
    expect(AI_ANALYSIS_PROMPT).toContain('Erfinde keine fehlenden Werte');
    expect(AI_ANALYSIS_PROMPT).toContain('vier Wochen');
  });
});
