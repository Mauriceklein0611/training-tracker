import type {
  CardioModality,
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

/** Strength equipment in display order (unspecified first as the neutral default). */
export const STRENGTH_EQUIPMENT_VALUES: Equipment[] = [
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

/** Cardio devices, offered when the tracking type is cardio. */
export const CARDIO_EQUIPMENT_VALUES: Equipment[] = [
  'unspecified',
  'treadmill',
  'ergometer',
  'rowing_machine',
  'elliptical',
  'stair_climber',
  'pool',
  'jump_rope',
  'other',
];

/** All selectable equipment in display order. */
export const EQUIPMENT_VALUES: Equipment[] = [
  ...STRENGTH_EQUIPMENT_VALUES.filter((value) => value !== 'other'),
  ...CARDIO_EQUIPMENT_VALUES.filter(
    (value) => value !== 'unspecified' && value !== 'other',
  ),
  'other',
];

/** Equipment offered for a tracking type: cardio devices for cardio, else strength. */
export function equipmentValuesFor(trackingType: TrackingType): Equipment[] {
  return trackingType === 'cardio' ? CARDIO_EQUIPMENT_VALUES : STRENGTH_EQUIPMENT_VALUES;
}

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
  treadmill: 'Laufband',
  ergometer: 'Ergometer/Fahrrad',
  rowing_machine: 'Rudermaschine',
  elliptical: 'Crosstrainer',
  stair_climber: 'Stair Climber',
  pool: 'Pool',
  jump_rope: 'Springseil',
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
  /** The cardio activity (cardio sets only); absent for strength/duration. */
  cardioModality?: CardioModality;
}

type SetExecutionFields = Pick<
  WorkoutSet,
  | 'trackingTypeSnapshot'
  | 'weightModeSnapshot'
  | 'weightMultiplierSnapshot'
  | 'equipmentSnapshot'
  | 'cardioModalitySnapshot'
>;

type ContextExecutionFields = Pick<
  SessionExercise,
  | 'trackingTypeSnapshot'
  | 'weightModeSnapshot'
  | 'weightMultiplierSnapshot'
  | 'equipmentSnapshot'
  | 'cardioModalitySnapshot'
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
    cardioModality: set.cardioModalitySnapshot ?? context.cardioModalitySnapshot,
  };
}

/**
 * The single, central grouping key for "the same execution of an exercise".
 *
 * Every place that compares sets like-for-like — next-set prefill, the "last
 * time" comparison, personal records, the 1RM/best baseline, progression and
 * the AI export's record marking — must derive its grouping from this one
 * function. Keeping a single definition is what stops a dumbbell set from ever
 * being silently compared against, or overwriting the record of, a barbell set.
 *
 * The key carries the exercise id plus the parts of the effective execution
 * that change what the numbers *mean*: tracking type, equipment and weight mode.
 * The weight multiplier is included only when it actually changes the load
 * (per-hand work); for every other mode the multiplier is irrelevant to the
 * load, so it is normalised out to keep the key stable. History performed with a
 * single, consistent execution collapses to exactly one key, unchanged.
 */
export function executionKey(
  exerciseId: string,
  execution: Pick<
    EffectiveExecution,
    'trackingType' | 'equipment' | 'weightMode' | 'weightMultiplier' | 'cardioModality'
  >,
): string {
  const multiplierPart =
    execution.weightMode === 'per_hand' ? `x${execution.weightMultiplier}` : 'x1';
  // For cardio the modality (not the weight mode) is what separates executions.
  const cardioPart =
    execution.trackingType === 'cardio' ? (execution.cardioModality ?? 'other') : '-';
  return [
    exerciseId,
    execution.trackingType,
    execution.equipment,
    execution.weightMode,
    multiplierPart,
    cardioPart,
  ].join('|');
}

/** Convenience: the {@link executionKey} for a concrete set in its context. */
export function setExecutionKey(
  exerciseId: string,
  set: SetExecutionFields,
  context: ContextExecutionFields,
): string {
  return executionKey(exerciseId, effectiveSetExecution(set, context));
}
