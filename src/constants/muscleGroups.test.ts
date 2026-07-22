import { describe, expect, it } from 'vitest';
import {
  findMuscleGroupByLabel,
  groupMuscleGroupsByCategory,
  isKnownMuscleGroup,
  MUSCLE_GROUPS,
  normalizeMuscleQuery,
  searchMuscleGroups,
} from '@/constants/muscleGroups';

describe('muscle-group catalog', () => {
  it('has stable unique ids and canonical labels', () => {
    const ids = new Set(MUSCLE_GROUPS.map((entry) => entry.id));
    expect(ids.size).toBe(MUSCLE_GROUPS.length);
    const labels = new Set(MUSCLE_GROUPS.map((entry) => entry.label));
    expect(labels.size).toBe(MUSCLE_GROUPS.length);
  });
});

describe('searchMuscleGroups', () => {
  it('finds by canonical German name', () => {
    expect(searchMuscleGroups('Latissimus').map((e) => e.id)).toContain('lats');
  });

  it('finds by English synonym, case-insensitively', () => {
    expect(searchMuscleGroups('rear delt').map((e) => e.id)).toContain('delt-rear');
    expect(searchMuscleGroups('HAMSTRINGS').map((e) => e.id)).toContain('hamstrings');
  });

  it('finds by category', () => {
    const ids = searchMuscleGroups('Rücken').map((e) => e.id);
    expect(ids).toContain('lats');
    expect(ids).toContain('erectors');
  });

  it('ignores diacritics and the sharp s', () => {
    // "gesass" should match the "Gesäß und Hüfte" category entries.
    const ids = searchMuscleGroups('gesass').map((e) => e.id);
    expect(ids).toContain('glute-max');
  });

  it('returns the whole catalog for an empty query', () => {
    expect(searchMuscleGroups('   ')).toHaveLength(MUSCLE_GROUPS.length);
  });
});

describe('normalizeMuscleQuery', () => {
  it('lowercases, trims, collapses spaces and strips diacritics', () => {
    expect(normalizeMuscleQuery('  Gesäß   Muskel ')).toBe('gesass muskel');
  });
});

describe('known vs custom values', () => {
  it('recognises a canonical label regardless of case', () => {
    expect(isKnownMuscleGroup('brust')).toBe(true);
    expect(findMuscleGroupByLabel('BRUST')?.id).toBe('chest');
  });

  it('treats an unknown legacy value as custom', () => {
    expect(isKnownMuscleGroup('Mein eigener Muskel')).toBe(false);
    expect(findMuscleGroupByLabel('Mein eigener Muskel')).toBeUndefined();
  });
});

describe('groupMuscleGroupsByCategory', () => {
  it('groups in the fixed category order and drops empty categories', () => {
    const grouped = groupMuscleGroupsByCategory(searchMuscleGroups('Bizeps'));
    expect(grouped).toHaveLength(1);
    expect(grouped[0].category).toBe('Arme und Griff');
  });
});
