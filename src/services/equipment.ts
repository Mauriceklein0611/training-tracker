import type {
  Equipment,
  SessionExercise,
  TrackingType,
  WeightMode,
  WorkoutSet,
} from '@/types';
import { allowedWeightModes, defaultWeightModeFor } from '@/services/exerciseRules';

/**
 * Structured equipment (Feature 3/4).
 *
 * Stable internal enum values with German UI labels. `unspecified` is the
 * neutral fallback and is never inferred from an exercise name or the free-text
 * `equipment` field. A set's *effective* execution is resolved field-by-field:
 * per-set snapshot → session-exercise snapshot → neutral default, so historic
 * sets keep the execution they were actually performed with.
 */

/** Selectable equipment in display order (unspecified first as the neutral default). */
export const EQUIPMENT_VALUES: Equipment[] = [
  'unspecified',
  'barbell',
  'dumbbells',
  'machine',
  'cable',
  'kettlebell',
  'bodyweight',
  'band',
  'trx',
  'other',
];

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  unspecified: 'Nicht festgelegt',
  barbell: 'Langhantel',
  dumbbells: 'Kurzhanteln',
  machine: 'Maschine',
  cable: 'Kabelzug',
  kettlebell: 'Kettlebell',
  bodyweight: 'Körpergewicht',
  band: 'Widerstandsband',
  trx: 'TRX',
  other: 'Sonstige',
};

export function equipmentLabel(equipment: Equipment | undefined): string {
  return EQUIPMENT_LABELS[equipment ?? 'unspecified'];
}

/**
 * The weight mode to suggest for an equipment within the current tracking type's
 * allowed set. Dumbbells and kettlebells suggest "per hand" when the tracking
 * type permits it; barbells and machines suggest the total load. The suggestion
 * is never forced — the caller may still pick any allowed mode.
 */
export function suggestedWeightModeForEquipment(
  equipment: Equipment,
  trackingType: TrackingType,
): WeightMode {
  const allowed = allowedWeightModes(trackingType);
  const prefersPerHand = equipment === 'dumbbells' || equipment === 'kettlebell';
  if (prefersPerHand && allowed.includes('per_hand')) return 'per_hand';
  if (allowed.includes('total')) return 'total';
  return defaultWeightModeFor(trackingType);
}

/** Sensible multiplier for a weight mode: two-sided per-hand work doubles the load. */
export function suggestedMultiplierForWeightMode(weightMode: WeightMode): number {
  return weightMode === 'per_hand' ? 2 : 1;
}

export interface EffectiveExecution {
  trackingType: TrackingType;
  weightMode: WeightMode;
  weightMultiplier: number;
  equipment: Equipment;
}

type SetExecutionFields = Pick<
  WorkoutSet,
  | 'trackingTypeSnapshot'
  | 'weightModeSnapshot'
  | 'weightMultiplierSnapshot'
  | 'equipmentSnapshot'
>;

type ContextExecutionFields = Pick<
  SessionExercise,
  | 'trackingTypeSnapshot'
  | 'weightModeSnapshot'
  | 'weightMultiplierSnapshot'
  | 'equipmentSnapshot'
>;

/**
 * Resolves the execution actually used for a set, preferring the per-set
 * snapshot over the session-exercise snapshot and falling back field-by-field.
 * Never reads the live exercise, so editing an exercise cannot rewrite history.
 */
export function effectiveSetExecution(
  set: SetExecutionFields,
  context: ContextExecutionFields,
): EffectiveExecution {
  return {
    trackingType: set.trackingTypeSnapshot ?? context.trackingTypeSnapshot,
    weightMode: set.weightModeSnapshot ?? context.weightModeSnapshot,
    weightMultiplier:
      set.weightMultiplierSnapshot ?? context.weightMultiplierSnapshot ?? 1,
    equipment: set.equipmentSnapshot ?? context.equipmentSnapshot ?? 'unspecified',
  };
}
