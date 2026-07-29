import { describe, expect, it } from 'vitest';
import { setLanguage } from '@/i18n';
import {
  formatKg,
  formatNumber,
  formatSections,
  formatSets,
  pluralSection,
  pluralSet,
} from '@/utils/format';

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

describe('English count plurals', () => {
  it('uses the singular only for exactly one set', () => {
    setLanguage('en');
    expect(formatSets(0)).toBe('0 sets');
    expect(formatSets(1)).toBe('1 set');
    expect(formatSets(2)).toBe('2 sets');
    expect(pluralSet(1)).toBe('set');
    expect(pluralSet(3)).toBe('sets');
  });

  it('uses the singular only for exactly one cardio section', () => {
    setLanguage('en');
    expect(formatSections(1)).toBe('1 section');
    expect(formatSections(4)).toBe('4 sections');
  });
});

describe('number formatting per language', () => {
  it('uses a decimal comma and dot grouping in German', () => {
    expect(formatKg(42.5)).toBe('42,5 kg');
    expect(formatNumber(1234)).toBe('1.234');
  });

  it('uses a decimal point and comma grouping in English', () => {
    setLanguage('en');
    expect(formatKg(42.5)).toBe('42.5 kg');
    expect(formatNumber(1234)).toBe('1,234');
  });

  it('never invents a value for missing input', () => {
    for (const language of ['de', 'en'] as const) {
      setLanguage(language);
      expect(formatKg(null)).toBe('–');
      expect(formatNumber(undefined)).toBe('–');
    }
  });
});
