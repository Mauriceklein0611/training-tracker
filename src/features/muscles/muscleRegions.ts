/**
 * Schematic body regions for the local muscle map.
 *
 * A deliberately simple, offline SVG: each region is one or more basic shapes
 * on a front or back figure (viewBox 0 0 100 200). The catalog's fine-grained
 * muscle groups (e.g. the three trapezius parts) map onto the visual region that
 * best represents them, so every stored muscle label resolves to a body area.
 * Nothing here is a medical illustration — it is an at-a-glance overview.
 */

export type BodyView = 'front' | 'back';

export type RegionShape =
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r?: number };

export interface BodyRegion {
  id: string;
  /** Human label for the textual alternative and tap target. */
  label: string;
  view: BodyView;
  shapes: RegionShape[];
}

const ell = (cx: number, cy: number, rx: number, ry: number): RegionShape => ({
  kind: 'ellipse',
  cx,
  cy,
  rx,
  ry,
});

/** Mirror an ellipse across the vertical centre line (x = 50) for paired muscles. */
function paired(cx: number, cy: number, rx: number, ry: number): RegionShape[] {
  return [ell(cx, cy, rx, ry), ell(100 - cx, cy, rx, ry)];
}

export const BODY_REGIONS: BodyRegion[] = [
  // ---- front ----
  { id: 'neck', label: 'Nacken', view: 'front', shapes: [ell(50, 26, 6, 4)] },
  {
    id: 'shoulders-front',
    label: 'Schultern (vorn)',
    view: 'front',
    shapes: paired(31, 40, 7, 6),
  },
  { id: 'chest', label: 'Brust', view: 'front', shapes: paired(42, 47, 9, 7) },
  { id: 'biceps', label: 'Bizeps', view: 'front', shapes: paired(25, 58, 5, 9) },
  {
    id: 'forearms-front',
    label: 'Unterarme',
    view: 'front',
    shapes: paired(20, 76, 4, 10),
  },
  { id: 'abs', label: 'Bauch', view: 'front', shapes: [ell(50, 66, 9, 12)] },
  {
    id: 'obliques',
    label: 'Seitliche Bauchmuskeln',
    view: 'front',
    shapes: paired(38, 66, 4, 11),
  },
  { id: 'quads', label: 'Quadrizeps', view: 'front', shapes: paired(42, 108, 8, 20) },
  { id: 'adductors', label: 'Adduktoren', view: 'front', shapes: paired(46, 100, 4, 14) },
  { id: 'tibialis', label: 'Schienbein', view: 'front', shapes: paired(43, 152, 5, 18) },

  // ---- back ----
  { id: 'traps', label: 'Trapezmuskel', view: 'back', shapes: [ell(50, 36, 12, 8)] },
  {
    id: 'shoulders-rear',
    label: 'Schultern (hinten)',
    view: 'back',
    shapes: paired(31, 42, 7, 6),
  },
  { id: 'lats', label: 'Latissimus', view: 'back', shapes: paired(40, 56, 9, 12) },
  { id: 'rhomboids', label: 'Rhomboiden', view: 'back', shapes: [ell(50, 50, 8, 7)] },
  { id: 'triceps', label: 'Trizeps', view: 'back', shapes: paired(25, 58, 5, 10) },
  {
    id: 'forearms-back',
    label: 'Unterarme',
    view: 'back',
    shapes: paired(20, 76, 4, 10),
  },
  {
    id: 'lower-back',
    label: 'Unterer Rücken',
    view: 'back',
    shapes: [ell(50, 72, 9, 8)],
  },
  { id: 'glutes', label: 'Gesäß', view: 'back', shapes: paired(43, 88, 8, 8) },
  { id: 'hamstrings', label: 'Beinbeuger', view: 'back', shapes: paired(42, 112, 8, 20) },
  { id: 'calves', label: 'Waden', view: 'back', shapes: paired(43, 152, 6, 18) },
];

export const BODY_REGIONS_BY_ID: Record<string, BodyRegion> = Object.fromEntries(
  BODY_REGIONS.map((region) => [region.id, region]),
);

/**
 * Maps every catalog muscle-group *label* (the value stored on an exercise) to
 * the visual region that represents it. Several fine groups share one region.
 * `full-body` intentionally has no single region — the caller lights all of them.
 */
export const MUSCLE_LABEL_TO_REGION: Record<string, string> = {
  // Chest
  Brust: 'chest',
  'Obere Brust': 'chest',
  'Untere Brust': 'chest',
  // Back
  Latissimus: 'lats',
  'Trapezmuskel oben': 'traps',
  'Trapezmuskel mittig': 'traps',
  'Trapezmuskel unten': 'traps',
  Rhomboiden: 'rhomboids',
  Rückenstrecker: 'lower-back',
  'Unterer Rücken': 'lower-back',
  // Shoulders
  'Vordere Schulter': 'shoulders-front',
  'Seitliche Schulter': 'shoulders-front',
  'Hintere Schulter': 'shoulders-rear',
  Rotatorenmanschette: 'shoulders-rear',
  // Arms
  Bizeps: 'biceps',
  Brachialis: 'biceps',
  Trizeps: 'triceps',
  Brachioradialis: 'forearms-front',
  Unterarme: 'forearms-front',
  Griffkraft: 'forearms-front',
  // Core
  'Gerader Bauchmuskel': 'abs',
  'Tiefe Bauchmuskulatur/Core': 'abs',
  'Schräge Bauchmuskeln': 'obliques',
  Serratus: 'obliques',
  Nacken: 'neck',
  // Glutes and hips
  'Großer Gesäßmuskel': 'glutes',
  'Mittlerer Gesäßmuskel': 'glutes',
  'Kleiner Gesäßmuskel': 'glutes',
  Hüftbeuger: 'quads',
  Adduktoren: 'adductors',
  Abduktoren: 'glutes',
  // Legs
  Quadrizeps: 'quads',
  'Beinbeuger/Hamstrings': 'hamstrings',
  Waden: 'calves',
  Schienbeinmuskel: 'tibialis',
};

/** The region a muscle label maps to, or undefined for unknown/custom labels. */
export function regionForMuscle(label: string): string | undefined {
  return MUSCLE_LABEL_TO_REGION[label.trim()];
}

/** Reverse map: the catalog muscle labels that make up each region. */
export const MUSCLES_BY_REGION: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {};
  for (const [label, region] of Object.entries(MUSCLE_LABEL_TO_REGION)) {
    (map[region] ??= []).push(label);
  }
  return map;
})();

/** The catalog muscle labels represented by a region (empty for unknown ids). */
export function musclesForRegion(regionId: string): string[] {
  return MUSCLES_BY_REGION[regionId] ?? [];
}
