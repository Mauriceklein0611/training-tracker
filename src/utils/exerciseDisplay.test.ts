import { afterEach, describe, expect, it } from 'vitest';
import {
  SYSTEM_EXERCISES,
  type SystemExerciseCatalogKey,
} from '@/constants/exerciseCatalog';
import { setLanguage } from '@/i18n';
import { ENGLISH_SYSTEM_EXERCISES } from '@/i18n/exerciseCatalog.en';
import type { ExerciseDisplayInput } from '@/utils/exerciseDisplay';
import { exerciseDisplayName, exerciseSearchText } from '@/utils/exerciseDisplay';

function untouchedSystemExercise(
  catalogKey: SystemExerciseCatalogKey,
): ExerciseDisplayInput {
  const catalogExercise = SYSTEM_EXERCISES.find(
    (exercise) => exercise.catalogKey === catalogKey,
  );
  if (!catalogExercise) throw new Error(`Unknown catalog key: ${catalogKey}`);
  return {
    name: catalogExercise.name,
    origin: 'system',
    catalogKey,
    searchTerms: [...catalogExercise.searchTerms],
  };
}

afterEach(() => {
  setLanguage('de');
});

describe('system exercise localization data', () => {
  it('covers every stable catalog key with a name and English search synonyms', () => {
    expect(Object.keys(ENGLISH_SYSTEM_EXERCISES).sort()).toEqual(
      SYSTEM_EXERCISES.map((exercise) => exercise.catalogKey).sort(),
    );

    for (const exercise of SYSTEM_EXERCISES) {
      const localized = ENGLISH_SYSTEM_EXERCISES[exercise.catalogKey];
      expect(localized.name.trim(), `${exercise.catalogKey} name`).not.toBe('');
      expect(
        localized.searchSynonyms.length,
        `${exercise.catalogKey} synonyms`,
      ).toBeGreaterThan(0);
      for (const synonym of localized.searchSynonyms) {
        expect(synonym.trim(), `${exercise.catalogKey} synonym`).not.toBe('');
      }
    }
  });
});

describe('exerciseDisplayName', () => {
  it('keeps the canonical saved German name in German', () => {
    setLanguage('de');
    expect(exerciseDisplayName(untouchedSystemExercise('bench-press'))).toBe(
      'Bankdrücken',
    );
  });

  it('uses the English display name for an untouched system exercise', () => {
    setLanguage('en');
    expect(exerciseDisplayName(untouchedSystemExercise('bench-press'))).toBe(
      'Bench Press',
    );
    expect(exerciseDisplayName(untouchedSystemExercise('cardio-ergometer'))).toBe(
      'Stationary Bike',
    );
  });

  it('keeps the saved name for custom and legacy exercises', () => {
    setLanguage('en');
    expect(
      exerciseDisplayName({
        name: 'My Press',
        origin: 'custom',
        catalogKey: 'bench-press',
        searchTerms: ['personal'],
      }),
    ).toBe('My Press');
    expect(
      exerciseDisplayName({
        name: 'Alte Übung',
        searchTerms: ['legacy'],
      }),
    ).toBe('Alte Übung');
  });

  it('keeps a user-renamed system exercise unchanged', () => {
    setLanguage('en');
    expect(
      exerciseDisplayName({
        ...untouchedSystemExercise('bench-press'),
        name: 'Mein Bankdrücken',
      }),
    ).toBe('Mein Bankdrücken');
  });
});

describe('exerciseSearchText', () => {
  it('adds the English name and English synonyms for untouched system entries', () => {
    setLanguage('en');
    const searchText = exerciseSearchText(untouchedSystemExercise('bench-press'));
    expect(searchText).toContain('Bench Press');
    expect(searchText).toContain('barbell bench press');
    expect(searchText).toContain('flat bench press');
    expect(searchText).toContain('Bankdrücken');
  });

  it('does not inject catalog translations into custom, legacy or renamed rows', () => {
    setLanguage('en');
    const rows: ExerciseDisplayInput[] = [
      {
        name: 'My Press',
        origin: 'custom',
        catalogKey: 'bench-press',
        searchTerms: ['personal'],
      },
      { name: 'Legacy Press', searchTerms: ['old'] },
      {
        ...untouchedSystemExercise('bench-press'),
        name: 'Renamed Press',
        searchTerms: ['mine'],
      },
    ];

    for (const row of rows) {
      const searchText = exerciseSearchText(row);
      expect(searchText).toContain(row.name);
      expect(searchText).not.toContain('flat bench press');
    }
  });
});
