import type { TrackingType, WeightMode } from '@/types';
import { requiredFieldsFor } from '@/services/metrics';
import { t } from '@/i18n';

/**
 * Input validation for a single set, expressed as messages per field.
 *
 * Kept outside the components so the same rules apply to the live view, the
 * history correction dialog and any future entry point.
 */

export interface SetInputValues {
  weightKg?: number | null;
  reps?: number | null;
  durationSeconds?: number | null;
  rir?: number | null;
  rpe?: number | null;
}

export type SetFieldErrors = Partial<Record<keyof SetInputValues, string>>;

export function validateSetInput(
  values: SetInputValues,
  trackingType: TrackingType,
  weightMode: WeightMode,
): SetFieldErrors {
  const errors: SetFieldErrors = {};
  const required = requiredFieldsFor(trackingType);

  if (values.weightKg != null) {
    if (Number.isNaN(values.weightKg)) errors.weightKg = t('common:validation.number');
    else if (values.weightKg < 0) errors.weightKg = t('common:validation.weightNegative');
    else if (values.weightKg > 1000) errors.weightKg = t('common:validation.weightHigh');
  } else if (required.weight && weightMode !== 'none') {
    errors.weightKg = t('common:validation.weightMissing');
  }

  if (values.reps != null) {
    if (Number.isNaN(values.reps)) errors.reps = t('common:validation.number');
    else if (!Number.isInteger(values.reps))
      errors.reps = t('common:validation.repsInteger');
    else if (values.reps < 0) errors.reps = t('common:validation.repsNegative');
    else if (values.reps > 10000) errors.reps = t('common:validation.repsHigh');
  } else if (required.reps) {
    errors.reps = t('common:validation.repsMissing');
  }

  if (values.durationSeconds != null) {
    if (Number.isNaN(values.durationSeconds))
      errors.durationSeconds = t('common:validation.number');
    else if (values.durationSeconds < 0)
      errors.durationSeconds = t('common:validation.durationNegative');
    else if (values.durationSeconds > 86400)
      errors.durationSeconds = t('common:validation.durationHigh');
  } else if (required.duration) {
    errors.durationSeconds = t('common:validation.durationMissing');
  }

  if (values.rir != null && !Number.isNaN(values.rir)) {
    if (values.rir < 0 || values.rir > 10) errors.rir = t('common:validation.rirRange');
  }

  if (values.rpe != null && !Number.isNaN(values.rpe)) {
    if (values.rpe < 1 || values.rpe > 10) errors.rpe = t('common:validation.rpeRange');
  }

  return errors;
}

export function hasErrors(errors: SetFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

export interface CardioSetInputValues {
  durationSeconds?: number | null;
  distanceMeters?: number | null;
  averageHeartRateBpm?: number | null;
  caloriesKcal?: number | null;
  elevationGainMeters?: number | null;
  cadenceRpm?: number | null;
  resistanceLevel?: number | null;
  rpe?: number | null;
}

export type CardioFieldErrors = Partial<Record<keyof CardioSetInputValues, string>>;

/** Plausibility bounds for cardio inputs (technical, never medical). */
const CARDIO_BOUNDS = {
  durationSeconds: { max: 86400, label: 'duration' },
  distanceMeters: { max: 1_000_000, label: 'distance' },
  averageHeartRateBpm: { min: 20, max: 300, label: 'heartRate' },
  caloriesKcal: { max: 100_000, label: 'calories' },
  elevationGainMeters: { max: 100_000, label: 'elevation' },
  cadenceRpm: { max: 400, label: 'cadence' },
  resistanceLevel: { max: 100, label: 'resistance' },
} as const;

/**
 * Validates a cardio section. It may be completed once it carries a duration
 * OR a distance greater than zero; weight and repetitions are never required.
 * Every optional metric is only bounds-checked when present — a missing value
 * stays missing and is never invented as 0. All numbers must be finite and
 * non-negative.
 */
export function validateCardioSetInput(values: CardioSetInputValues): CardioFieldErrors {
  const errors: CardioFieldErrors = {};

  const checkNonNegative = (
    key: keyof CardioSetInputValues,
    value: number | null | undefined,
    bound: {
      min?: number;
      max: number;
      label: keyof typeof CARDIO_BOUNDS extends never
        ? never
        : | 'duration'
          | 'distance'
          | 'heartRate'
          | 'calories'
          | 'elevation'
          | 'cadence'
          | 'resistance';
    },
  ) => {
    if (value == null) return;
    if (!Number.isFinite(value)) {
      errors[key] = t('common:validation.validNumber');
    } else if (value < (bound.min ?? 0)) {
      const field = t(`common:validation.field.${bound.label}`);
      errors[key] =
        bound.min != null
          ? t('common:validation.minimum', { field, minimum: bound.min })
          : t('common:validation.negative', { field });
    } else if (value > bound.max) {
      errors[key] = t('common:validation.unrealistic', {
        field: t(`common:validation.field.${bound.label}`),
      });
    }
  };

  checkNonNegative(
    'durationSeconds',
    values.durationSeconds,
    CARDIO_BOUNDS.durationSeconds,
  );
  checkNonNegative('distanceMeters', values.distanceMeters, CARDIO_BOUNDS.distanceMeters);
  checkNonNegative(
    'averageHeartRateBpm',
    values.averageHeartRateBpm,
    CARDIO_BOUNDS.averageHeartRateBpm,
  );
  checkNonNegative('caloriesKcal', values.caloriesKcal, CARDIO_BOUNDS.caloriesKcal);
  checkNonNegative(
    'elevationGainMeters',
    values.elevationGainMeters,
    CARDIO_BOUNDS.elevationGainMeters,
  );
  checkNonNegative('cadenceRpm', values.cadenceRpm, CARDIO_BOUNDS.cadenceRpm);
  checkNonNegative(
    'resistanceLevel',
    values.resistanceLevel,
    CARDIO_BOUNDS.resistanceLevel,
  );

  if (values.rpe != null && Number.isFinite(values.rpe)) {
    if (values.rpe < 1 || values.rpe > 10) errors.rpe = t('common:validation.rpeRange');
  } else if (values.rpe != null) {
    errors.rpe = t('common:validation.validNumber');
  }

  return errors;
}

/**
 * Whether a cardio section carries enough to be completed: a positive duration
 * or a positive distance. Field-level errors (validateCardioSetInput) are a
 * separate concern; both must pass before a section is stored.
 */
export function cardioSectionComplete(values: CardioSetInputValues): boolean {
  const positive = (value: number | null | undefined) =>
    value != null && Number.isFinite(value) && value > 0;
  return positive(values.durationSeconds) || positive(values.distanceMeters);
}

export interface ExerciseFormValues {
  name: string;
  weightMultiplier: number;
  defaultRestSeconds: number;
}

export function validateExerciseForm(
  values: ExerciseFormValues,
  existingNames: string[] = [],
): Partial<Record<keyof ExerciseFormValues, string>> {
  const errors: Partial<Record<keyof ExerciseFormValues, string>> = {};
  const name = values.name.trim();

  if (!name) errors.name = t('common:validation.nameMissing');
  else if (name.length > 80) errors.name = t('common:validation.nameLong');
  else if (
    existingNames.some((existing) => existing.toLowerCase() === name.toLowerCase())
  ) {
    errors.name = t('common:validation.nameExists');
  }

  if (!Number.isFinite(values.weightMultiplier) || values.weightMultiplier <= 0) {
    errors.weightMultiplier = t('common:validation.multiplierPositive');
  } else if (values.weightMultiplier > 10) {
    errors.weightMultiplier = t('common:validation.multiplierHigh');
  }

  if (
    !Number.isInteger(values.defaultRestSeconds) ||
    values.defaultRestSeconds < 0 ||
    values.defaultRestSeconds > 3600
  ) {
    errors.defaultRestSeconds = t('common:validation.restRange');
  }

  return errors;
}

/**
 * Parses a number typed on a mobile keyboard.
 * Accepts a comma as decimal separator and returns `null` for empty input.
 */
export function parseNumberInput(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : Number.NaN;
}
