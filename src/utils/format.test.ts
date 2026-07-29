import { describe, expect, it } from 'vitest';
import { formatSections, formatSets, pluralSection, pluralSet } from '@/utils/format';

describe('German count plurals', () => {
  it('uses the singular only for exactly one set', () => {
    expect(formatSets(0)).toBe('0 Sätze');
    expect(formatSets(1)).toBe('1 Satz');
    expect(formatSets(2)).toBe('2 Sätze');
    expect(pluralSet(1)).toBe('Satz');
    expect(pluralSet(3)).toBe('Sätze');
  });

  it('uses the singular only for exactly one cardio section', () => {
    expect(formatSections(0)).toBe('0 Abschnitte');
    expect(formatSections(1)).toBe('1 Abschnitt');
    expect(formatSections(2)).toBe('2 Abschnitte');
    expect(pluralSection(1)).toBe('Abschnitt');
    expect(pluralSection(5)).toBe('Abschnitte');
  });
});
