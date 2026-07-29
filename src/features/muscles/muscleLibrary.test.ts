import { describe, expect, it } from 'vitest';
import {
  buildBodyData,
  slugForMuscle,
  USED_SLUGS,
  type SlugColors,
} from '@/features/muscles/muscleLibrary';
import { MUSCLE_GROUPS } from '@/constants/muscleGroups';

const COLORS: SlugColors = {
  primary: 'PRIMARY',
  secondary: 'SECONDARY',
  inactive: 'INACTIVE',
};

describe('muscle library adapter', () => {
  it('maps every catalog muscle label (except Ganzkörper) to a slug', () => {
    const unmapped = MUSCLE_GROUPS.filter(
      (group) => group.label !== 'Ganzkörper' && !slugForMuscle(group.label),
    );
    expect(unmapped.map((group) => group.label)).toEqual([]);
  });

  it('colours every used slug so inactive muscles are themed too', () => {
    const data = buildBodyData(['Brust'], [], COLORS);
    // Every used slug is present (plus decorative head/hands/etc. as inactive).
    expect(data.length).toBeGreaterThanOrEqual(USED_SLUGS.length);
    for (const slug of USED_SLUGS) {
      expect(data.some((d) => d.slug === slug)).toBe(true);
    }
    expect(data.find((d) => d.slug === 'chest')?.color).toBe('PRIMARY');
    // A muscle that is not involved still carries the inactive colour.
    expect(data.find((d) => d.slug === 'calves')?.color).toBe('INACTIVE');
    // Decorative parts (head) are themed inactive, never highlighted.
    expect(data.find((d) => d.slug === 'head')?.color).toBe('INACTIVE');
  });

  it('lets primary win over secondary for the same slug', () => {
    // Bizeps and Brachialis both map to "biceps"; primary must win.
    const data = buildBodyData(['Bizeps'], ['Brachialis'], COLORS);
    expect(data.find((d) => d.slug === 'biceps')?.color).toBe('PRIMARY');
  });

  it('lights the whole body for "Ganzkörper"', () => {
    const data = buildBodyData(['Ganzkörper'], [], COLORS);
    // Every used slug is primary; decorative parts stay inactive.
    for (const slug of USED_SLUGS) {
      expect(data.find((d) => d.slug === slug)?.color).toBe('PRIMARY');
    }
  });

  it('ignores custom labels with no region', () => {
    const data = buildBodyData(['Nasenmuskel'], [], COLORS);
    expect(data.every((d) => d.color === 'INACTIVE')).toBe(true);
  });
});
