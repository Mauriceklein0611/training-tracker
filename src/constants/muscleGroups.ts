import { t } from '@/i18n';
import type { Domain } from '@/i18n/locales/de/domain';

/**
 * Local, offline muscle-group catalog.
 *
 * The single source of truth for the searchable muscle-group picker. Each entry
 * has a stable internal id, a canonical German label (this is what gets stored
 * in `Exercise.primaryMuscleGroup` / `secondaryMuscleGroups`), a category for
 * grouping, and search synonyms (incl. common English terms).
 *
 * Stored values that are not in this catalog are never dropped — they are kept
 * and shown as custom entries (see `isKnownMuscleGroup`).
 */

export interface MuscleGroup {
  id: string;
  /** Canonical German label — the value stored on an exercise. */
  label: string;
  category: string;
  /** Extra terms the search should match, beyond label and category. */
  synonyms: string[];
}

/** Category display order. */
export const MUSCLE_GROUP_CATEGORIES = [
  'Brust',
  'Rücken',
  'Schultern',
  'Arme und Griff',
  'Rumpf',
  'Gesäß und Hüfte',
  'Beine',
  'Sonstiges',
] as const;

export const MUSCLE_GROUPS: MuscleGroup[] = [
  // Brust
  {
    id: 'chest',
    label: 'Brust',
    category: 'Brust',
    synonyms: ['chest', 'pecs', 'pectoralis'],
  },
  {
    id: 'chest-upper',
    label: 'Obere Brust',
    category: 'Brust',
    synonyms: ['upper chest', 'incline'],
  },
  {
    id: 'chest-lower',
    label: 'Untere Brust',
    category: 'Brust',
    synonyms: ['lower chest', 'decline'],
  },

  // Rücken
  {
    id: 'lats',
    label: 'Latissimus',
    category: 'Rücken',
    synonyms: ['lat', 'lats', 'rücken', 'lats'],
  },
  {
    id: 'traps-upper',
    label: 'Trapezmuskel oben',
    category: 'Rücken',
    synonyms: ['upper traps', 'trapez', 'nacken'],
  },
  {
    id: 'traps-mid',
    label: 'Trapezmuskel mittig',
    category: 'Rücken',
    synonyms: ['mid traps', 'trapez'],
  },
  {
    id: 'traps-lower',
    label: 'Trapezmuskel unten',
    category: 'Rücken',
    synonyms: ['lower traps', 'trapez'],
  },
  {
    id: 'rhomboids',
    label: 'Rhomboiden',
    category: 'Rücken',
    synonyms: ['rhomboids', 'rhomboid'],
  },
  {
    id: 'erectors',
    label: 'Rückenstrecker',
    category: 'Rücken',
    synonyms: ['erector', 'spinae', 'back extensors'],
  },

  // Schultern
  {
    id: 'delt-front',
    label: 'Vordere Schulter',
    category: 'Schultern',
    synonyms: ['front delt', 'vordere schulter', 'anterior deltoid'],
  },
  {
    id: 'delt-side',
    label: 'Seitliche Schulter',
    category: 'Schultern',
    synonyms: ['side delt', 'seitliche schulter', 'lateral deltoid'],
  },
  {
    id: 'delt-rear',
    label: 'Hintere Schulter',
    category: 'Schultern',
    synonyms: ['rear delt', 'hintere schulter', 'posterior deltoid'],
  },
  {
    id: 'rotator-cuff',
    label: 'Rotatorenmanschette',
    category: 'Schultern',
    synonyms: ['rotator cuff', 'cuff'],
  },

  // Arme und Griff
  { id: 'biceps', label: 'Bizeps', category: 'Arme und Griff', synonyms: ['biceps'] },
  {
    id: 'brachialis',
    label: 'Brachialis',
    category: 'Arme und Griff',
    synonyms: ['brachialis'],
  },
  {
    id: 'brachioradialis',
    label: 'Brachioradialis',
    category: 'Arme und Griff',
    synonyms: ['brachioradialis'],
  },
  { id: 'triceps', label: 'Trizeps', category: 'Arme und Griff', synonyms: ['triceps'] },
  {
    id: 'forearms',
    label: 'Unterarme',
    category: 'Arme und Griff',
    synonyms: ['forearms', 'unterarm'],
  },
  {
    id: 'grip',
    label: 'Griffkraft',
    category: 'Arme und Griff',
    synonyms: ['grip', 'grip strength'],
  },

  // Rumpf
  {
    id: 'rectus-abdominis',
    label: 'Gerader Bauchmuskel',
    category: 'Rumpf',
    synonyms: ['abs', 'bauch', 'rectus', 'sixpack'],
  },
  {
    id: 'obliques',
    label: 'Schräge Bauchmuskeln',
    category: 'Rumpf',
    synonyms: ['obliques', 'schräge', 'bauch'],
  },
  {
    id: 'core',
    label: 'Tiefe Bauchmuskulatur/Core',
    category: 'Rumpf',
    synonyms: ['core', 'transverse', 'bauch'],
  },
  { id: 'serratus', label: 'Serratus', category: 'Rumpf', synonyms: ['serratus'] },
  {
    id: 'lower-back',
    label: 'Unterer Rücken',
    category: 'Rumpf',
    synonyms: ['lower back', 'unterer rücken'],
  },

  // Gesäß und Hüfte
  {
    id: 'glute-max',
    label: 'Großer Gesäßmuskel',
    category: 'Gesäß und Hüfte',
    synonyms: ['glutes', 'po', 'gesäß', 'glute max', 'maximus'],
  },
  {
    id: 'glute-med',
    label: 'Mittlerer Gesäßmuskel',
    category: 'Gesäß und Hüfte',
    synonyms: ['glute med', 'medius', 'gesäß'],
  },
  {
    id: 'glute-min',
    label: 'Kleiner Gesäßmuskel',
    category: 'Gesäß und Hüfte',
    synonyms: ['glute min', 'minimus', 'gesäß'],
  },
  {
    id: 'hip-flexors',
    label: 'Hüftbeuger',
    category: 'Gesäß und Hüfte',
    synonyms: ['hip flexors', 'hüftbeuger', 'iliopsoas'],
  },
  {
    id: 'adductors',
    label: 'Adduktoren',
    category: 'Gesäß und Hüfte',
    synonyms: ['adductors', 'inner thigh'],
  },
  {
    id: 'abductors',
    label: 'Abduktoren',
    category: 'Gesäß und Hüfte',
    synonyms: ['abductors', 'outer thigh'],
  },

  // Beine
  {
    id: 'quads',
    label: 'Quadrizeps',
    category: 'Beine',
    synonyms: ['quads', 'quadriceps', 'oberschenkel vorne'],
  },
  {
    id: 'hamstrings',
    label: 'Beinbeuger/Hamstrings',
    category: 'Beine',
    synonyms: ['hamstrings', 'beinbeuger', 'oberschenkel hinten'],
  },
  {
    id: 'calves',
    label: 'Waden',
    category: 'Beine',
    synonyms: ['calves', 'waden', 'gastrocnemius', 'soleus'],
  },
  {
    id: 'tibialis',
    label: 'Schienbeinmuskel',
    category: 'Beine',
    synonyms: ['tibialis', 'schienbein', 'shin'],
  },

  // Sonstiges
  { id: 'neck', label: 'Nacken', category: 'Sonstiges', synonyms: ['neck', 'nacken'] },
  {
    id: 'full-body',
    label: 'Ganzkörper',
    category: 'Sonstiges',
    synonyms: ['full body', 'ganzkörper', 'total body'],
  },
];

const MUSCLE_CATEGORY_KEYS: Record<
  (typeof MUSCLE_GROUP_CATEGORIES)[number],
  'chest' | 'back' | 'shoulders' | 'armsGrip' | 'core' | 'glutesHips' | 'legs' | 'other'
> = {
  Brust: 'chest',
  Rücken: 'back',
  Schultern: 'shoulders',
  'Arme und Griff': 'armsGrip',
  Rumpf: 'core',
  'Gesäß und Hüfte': 'glutesHips',
  Beine: 'legs',
  Sonstiges: 'other',
};

/** Localized display label while preserving the canonical stored German value. */
export function muscleGroupDisplayLabel(label: string): string {
  const known = MUSCLE_GROUPS.find((entry) => entry.label === label);
  const key = known?.id as keyof Domain['muscleGroup'] | undefined;
  return key ? t(`domain:muscleGroup.${key}`) : label;
}

/** Localized category label; category values remain canonical and stable. */
export function muscleCategoryDisplayLabel(category: string): string {
  const key = MUSCLE_CATEGORY_KEYS[category as (typeof MUSCLE_GROUP_CATEGORIES)[number]];
  return key ? t(`domain:muscleCategory.${key}`) : category;
}

const BY_LABEL = new Map(
  MUSCLE_GROUPS.map((entry) => [normalizeMuscleQuery(entry.label), entry]),
);

/** Lowercase, trim, collapse spaces and strip German diacritics for matching. */
export function normalizeMuscleQuery(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Whether a stored label matches a catalog entry (canonical, case-insensitive). */
export function isKnownMuscleGroup(label: string): boolean {
  return BY_LABEL.has(normalizeMuscleQuery(label));
}

export function findMuscleGroupByLabel(label: string): MuscleGroup | undefined {
  return BY_LABEL.get(normalizeMuscleQuery(label));
}

/**
 * Searches the catalog by canonical label, category and synonyms, ignoring case
 * and diacritics. An empty query returns the whole catalog (in catalog order).
 */
export function searchMuscleGroups(query: string): MuscleGroup[] {
  const q = normalizeMuscleQuery(query);
  if (!q) return MUSCLE_GROUPS;
  return MUSCLE_GROUPS.filter((entry) => {
    const haystack = [entry.label, entry.category, ...entry.synonyms].map(
      normalizeMuscleQuery,
    );
    return haystack.some((value) => value.includes(q));
  });
}

/** Groups entries by category, in the fixed category order, dropping empties. */
export function groupMuscleGroupsByCategory(
  entries: MuscleGroup[],
): { category: string; entries: MuscleGroup[] }[] {
  return MUSCLE_GROUP_CATEGORIES.map((category) => ({
    category,
    entries: entries.filter((entry) => entry.category === category),
  })).filter((group) => group.entries.length > 0);
}
