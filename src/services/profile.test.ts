import { describe, expect, it } from 'vitest';
import {
  ageFromBirthDate,
  bodyMassIndex,
  isPlausibleBirthDate,
  normalizeDisplayName,
  normalizeHeightCm,
} from '@/services/profile';

describe('ageFromBirthDate', () => {
  it('counts full years only', () => {
    expect(ageFromBirthDate('1996-08-06', '2026-08-06')).toBe(30);
    expect(ageFromBirthDate('1996-08-07', '2026-08-06')).toBe(29);
    expect(ageFromBirthDate('1996-12-31', '2026-08-06')).toBe(29);
  });

  it('is null without a date and for implausible ones', () => {
    expect(ageFromBirthDate(undefined)).toBeNull();
    expect(ageFromBirthDate('', '2026-08-06')).toBeNull();
    expect(ageFromBirthDate('2027-01-01', '2026-08-06')).toBeNull();
    expect(ageFromBirthDate('1899-12-31', '2026-08-06')).toBeNull();
    expect(ageFromBirthDate('06.08.1996', '2026-08-06')).toBeNull();
  });
});

describe('isPlausibleBirthDate', () => {
  it('accepts a real date up to today', () => {
    expect(isPlausibleBirthDate('2026-08-06', '2026-08-06')).toBe(true);
    expect(isPlausibleBirthDate('1900-01-01', '2026-08-06')).toBe(true);
  });

  it('rejects a date that does not exist', () => {
    expect(isPlausibleBirthDate('2026-02-31', '2026-08-06')).toBe(false);
    expect(isPlausibleBirthDate('2026-13-01', '2026-08-06')).toBe(false);
  });
});

describe('normalizeHeightCm', () => {
  it('rounds inside the plausible range and rejects outside it', () => {
    expect(normalizeHeightCm(182.4)).toBe(182);
    expect(normalizeHeightCm(49)).toBeNull();
    expect(normalizeHeightCm(281)).toBeNull();
    expect(normalizeHeightCm(null)).toBeNull();
  });
});

describe('normalizeDisplayName', () => {
  it('trims and drops an empty name', () => {
    expect(normalizeDisplayName('  Maurice  ')).toBe('Maurice');
    expect(normalizeDisplayName('   ')).toBeUndefined();
  });

  it('caps an absurdly long name instead of storing it whole', () => {
    expect(normalizeDisplayName('a'.repeat(200))).toHaveLength(60);
  });
});

describe('bodyMassIndex', () => {
  it('computes from height and weight', () => {
    expect(bodyMassIndex(180, 81)).toBeCloseTo(25, 5);
  });

  it('is null when either side is missing', () => {
    expect(bodyMassIndex(undefined, 81)).toBeNull();
    expect(bodyMassIndex(180, null)).toBeNull();
  });
});
