import { SYSTEM_EXERCISES } from '@/constants/exerciseCatalog';
import { getLanguage, localeTag } from '@/i18n';
import { ENGLISH_SYSTEM_EXERCISES } from '@/i18n/exerciseCatalog.en';
import type { Exercise } from '@/types';

export type ExerciseDisplayInput = Pick<
  Exercise,
  'name' | 'origin' | 'catalogKey' | 'searchTerms'
>;

const SYSTEM_EXERCISE_BY_KEY = new Map<string, (typeof SYSTEM_EXERCISES)[number]>(
  SYSTEM_EXERCISES.map((exercise) => [exercise.catalogKey, exercise]),
);

/**
 * Returns the catalog definition only when the saved row is still an untouched
 * system exercise. An exact name comparison is intentional: a user rename must
 * always win over presentation localisation.
 */
function untouchedSystemExercise(exercise: ExerciseDisplayInput) {
  if (exercise.origin !== 'system' || !exercise.catalogKey) return undefined;
  const catalogExercise = SYSTEM_EXERCISE_BY_KEY.get(exercise.catalogKey);
  if (!catalogExercise || exercise.name !== catalogExercise.name) return undefined;
  return catalogExercise;
}

/**
 * Localised presentation name without changing the persisted exercise.
 *
 * Custom exercises, legacy rows and renamed system exercises always retain the
 * exact name saved by the user.
 */
export function exerciseDisplayName(exercise: ExerciseDisplayInput): string {
  const catalogExercise = untouchedSystemExercise(exercise);
  if (!catalogExercise || getLanguage() !== 'en') return exercise.name;
  return ENGLISH_SYSTEM_EXERCISES[catalogExercise.catalogKey].name;
}

/**
 * Searchable text for the current UI language.
 *
 * Untouched system exercises gain their English display name and synonyms in
 * English. Saved names and saved search terms remain included for compatibility
 * and offline search. User-owned or edited rows never receive catalog text.
 */
export function exerciseSearchText(exercise: ExerciseDisplayInput): string {
  const terms = [exercise.name, ...(exercise.searchTerms ?? [])];
  const catalogExercise = untouchedSystemExercise(exercise);

  if (catalogExercise && getLanguage() === 'en') {
    const localized = ENGLISH_SYSTEM_EXERCISES[catalogExercise.catalogKey];
    terms.unshift(localized.name, ...localized.searchSynonyms);
  }

  const seen = new Set<string>();
  return terms
    .map((term) => term.trim())
    .filter((term) => {
      if (!term) return false;
      const normalized = term.toLocaleLowerCase(localeTag());
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .join(' ');
}
