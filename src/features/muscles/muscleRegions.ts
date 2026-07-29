/**
 * Muscle-group → body-region mapping.
 *
 * The catalog's fine-grained muscle groups (e.g. the three trapezius parts) are
 * grouped into coarser body regions. This is a pure lookup layer over the stored
 * muscle labels — it never renames or migrates data. The anatomical map composes
 * this with a region → library-slug table (see muscleLibrary), so every stored
 * muscle that resolves to a region also resolves to a slug on the figure.
 */

/**
 * Maps every catalog muscle-group *label* (the value stored on an exercise) to a
 * body region. Several fine groups share one region. `Ganzkörper` intentionally
 * has no single region — callers light the whole body.
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
