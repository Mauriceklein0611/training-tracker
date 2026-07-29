import type { ExtendedBodyPart, Slug } from 'react-muscle-highlighter';
import { regionForMuscle } from '@/features/muscles/muscleRegions';

/**
 * Adapter from the app's muscle-group catalog to react-muscle-highlighter slugs.
 *
 * This is a pure presentation layer: it never renames or migrates stored data.
 * The catalog label → schematic region mapping (already tested for
 * completeness) is reused and composed with a region → library-slug table, so
 * every catalog muscle that resolves to a region also resolves to a slug.
 * A few regions are coarser in the library and are documented here.
 */

/** Region id (see muscleRegions) → the library slug that best represents it. */
const REGION_TO_SLUG: Record<string, Slug> = {
  chest: 'chest',
  // The library has no separate lats/rhomboids; both fold into "upper-back".
  lats: 'upper-back',
  rhomboids: 'upper-back',
  traps: 'trapezius',
  'lower-back': 'lower-back',
  // The library has one "deltoids" slug, drawn on both the front and back
  // figure, so the front/rear shoulder regions still land on the right view.
  'shoulders-front': 'deltoids',
  'shoulders-rear': 'deltoids',
  biceps: 'biceps',
  triceps: 'triceps',
  'forearms-front': 'forearm',
  'forearms-back': 'forearm',
  abs: 'abs',
  obliques: 'obliques',
  neck: 'neck',
  glutes: 'gluteal',
  quads: 'quadriceps',
  adductors: 'adductors',
  hamstrings: 'hamstring',
  calves: 'calves',
  tibialis: 'tibialis',
};

/** Every slug the app can light up, for the "Ganzkörper" case and inactive fill. */
export const USED_SLUGS: Slug[] = [...new Set(Object.values(REGION_TO_SLUG))];

const FULL_BODY = 'Ganzkörper';

/** The library slug a catalog muscle label maps to, or undefined for custom ones. */
export function slugForMuscle(label: string): Slug | undefined {
  const region = regionForMuscle(label);
  return region ? REGION_TO_SLUG[region] : undefined;
}

export type Emphasis = 'primary' | 'secondary';

export interface SlugColors {
  primary: string;
  secondary: string;
  inactive: string;
}

/**
 * Builds the `data` array for the library: every used slug gets a colour so the
 * inactive muscles are themed too (the library otherwise paints untouched parts
 * a fixed grey). Primary wins over secondary; "Ganzkörper" lights everything.
 */
export function buildBodyData(
  primary: string[],
  secondary: string[],
  colors: SlugColors,
): ExtendedBodyPart[] {
  const level = new Map<Slug, Emphasis>();

  const apply = (labels: string[], emphasis: Emphasis) => {
    for (const raw of labels) {
      const label = raw.trim();
      if (label === FULL_BODY) {
        for (const slug of USED_SLUGS) {
          if (emphasis === 'primary' || !level.has(slug)) level.set(slug, emphasis);
        }
        continue;
      }
      const slug = slugForMuscle(label);
      if (!slug) continue;
      if (emphasis === 'primary' || !level.has(slug)) level.set(slug, emphasis);
    }
  };

  apply(secondary, 'secondary');
  apply(primary, 'primary'); // primary applied last so it wins

  return USED_SLUGS.map((slug) => {
    const emphasis = level.get(slug);
    const color =
      emphasis === 'primary'
        ? colors.primary
        : emphasis === 'secondary'
          ? colors.secondary
          : colors.inactive;
    return { slug, color };
  });
}
