import { localeTag, t } from '@/i18n';
import type { BodyMeasurements, SetType, TrackingType, WeightMode } from '@/types';

/**
 * Display labels for the domain enums, resolved in the active language (#31).
 *
 * These are presentation only. The CSV export keeps its own German label maps
 * and the AI export keeps its own, so no format can inherit the UI language
 * (asserted by `services/exportLanguageIndependence.test.ts`). Stored values are
 * always the enum key, never a label.
 *
 * The enum orders are exported separately because several screens render a
 * picker over all values and must not depend on object key order of a
 * translation file.
 */
export const TRACKING_TYPES: readonly TrackingType[] = [
  'weight_reps',
  'bodyweight_reps',
  'assisted_bodyweight_reps',
  'reps_only',
  'duration',
  'cardio',
];

export const WEIGHT_MODES: readonly WeightMode[] = [
  'per_hand',
  'total',
  'added_weight',
  'assistance',
  'none',
];

export const SET_TYPES: readonly SetType[] = ['warmup', 'working', 'drop', 'failure'];

export function trackingTypeLabel(type: TrackingType): string {
  return t(`domain:trackingType.${type}`);
}

export function trackingTypeHelp(type: TrackingType): string {
  return t(`domain:trackingTypeHelp.${type}`);
}

export function weightModeLabel(mode: WeightMode): string {
  return t(`domain:weightMode.${mode}`);
}

export function weightModeHelp(mode: WeightMode): string {
  return t(`domain:weightModeHelp.${mode}`);
}

export function setTypeLabel(type: SetType): string {
  return t(`domain:setType.${type}`);
}

export function setTypeShort(type: SetType): string {
  return t(`domain:setTypeShort.${type}`);
}

/** Common German muscle group suggestions for the exercise form. */
export const MUSCLE_GROUP_SUGGESTIONS = [
  'Brust',
  'Rücken',
  'Schultern',
  'Bizeps',
  'Trizeps',
  'Unterarme',
  'Bauch',
  'Rumpf',
  'Beine',
  'Quadrizeps',
  'Beinbeuger',
  'Gesäß',
  'Waden',
  'Ganzkörper',
];

export const EQUIPMENT_SUGGESTIONS = [
  'Langhantel',
  'Kurzhantel',
  'Maschine',
  'Kabelzug',
  'Körpergewicht',
  'TRX',
  'Kettlebell',
  'Band',
  'Sonstiges',
];

/**
 * The circumference fields, in the order they are shown, exported and charted.
 * One list drives the form, the CSV columns and the AI export, so the three can
 * never drift apart.
 */
export const BODY_MEASUREMENT_FIELDS: { key: keyof BodyMeasurements; label: string }[] = [
  { key: 'neckCm', label: 'Nacken' },
  { key: 'shoulderCm', label: 'Schultern' },
  { key: 'chestCm', label: 'Brust' },
  { key: 'waistCm', label: 'Taille' },
  { key: 'hipCm', label: 'Hüfte' },
  { key: 'bicepsLeftCm', label: 'Bizeps links' },
  { key: 'bicepsRightCm', label: 'Bizeps rechts' },
  { key: 'forearmLeftCm', label: 'Unterarm links' },
  { key: 'forearmRightCm', label: 'Unterarm rechts' },
  { key: 'thighLeftCm', label: 'Oberschenkel links' },
  { key: 'thighRightCm', label: 'Oberschenkel rechts' },
  { key: 'calfLeftCm', label: 'Wade links' },
  { key: 'calfRightCm', label: 'Wade rechts' },
];

/** Formats a circumference: "42,5 cm". */
export function formatCm(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '–';
  return `${(Math.round(value * 10) / 10).toLocaleString(localeTag(), {
    maximumFractionDigits: 1,
  })} cm`;
}

/** Formats a body fat percentage: "17,5 %". */
export function formatPercentValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '–';
  return `${(Math.round(value * 10) / 10).toLocaleString(localeTag(), {
    maximumFractionDigits: 1,
  })} %`;
}

/** Formats a weight with at most one decimal: "42,5 kg". */
export function formatKg(value: number | null | undefined, withUnit = true): string {
  if (value == null || !Number.isFinite(value)) return '–';
  const rounded = Math.round(value * 10) / 10;
  const text = rounded.toLocaleString(localeTag(), { maximumFractionDigits: 1 });
  return withUnit ? `${text} kg` : text;
}

/** Larger volumes are shown in tonnes to stay readable on a phone. */
export function formatVolume(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value === 0) return '–';
  if (value >= 10000) {
    return `${(value / 1000).toLocaleString(localeTag(), { maximumFractionDigits: 1 })} t`;
  }
  return formatKg(value);
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return '–';
  return value.toLocaleString(localeTag(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * Correct plurals for the two count nouns the app repeats everywhere. Strength
 * is counted in sets, cardio in sections; centralising them keeps a single
 * "1 Satz" / "2 Sätze" rule instead of scattered inline checks that drifted
 * into wrong forms like "1 Sätze".
 */
export function pluralSet(count: number): string {
  return count === 1 ? t('units.setOne') : t('units.setOther');
}

export function pluralSection(count: number): string {
  return count === 1 ? t('units.sectionOne') : t('units.sectionOther');
}

/** "0 Sätze" / "1 Satz" / "2 Sätze". */
export function formatSets(count: number): string {
  return `${formatNumber(count)} ${pluralSet(count)}`;
}

/** "0 Abschnitte" / "1 Abschnitt" / "2 Abschnitte". */
export function formatSections(count: number): string {
  return `${formatNumber(count)} ${pluralSection(count)}`;
}

export function formatPercent(ratio: number | null | undefined): string {
  if (ratio == null || !Number.isFinite(ratio)) return '–';
  return `${Math.round(ratio * 100)} %`;
}

/** Signed seconds, e.g. "+12 s" / "−8 s". */
export function formatSignedSeconds(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '–';
  const rounded = Math.round(value);
  if (rounded === 0) return '±0 s';
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)} s`;
}

/** One-line summary of a recorded set, used in history and "last performance". */
export function describeSet(
  set: {
    weightKg?: number;
    reps?: number;
    durationSeconds?: number;
  },
  trackingType: TrackingType,
  weightMode: WeightMode,
): string {
  if (trackingType === 'duration') {
    return set.durationSeconds != null ? `${Math.round(set.durationSeconds)} s` : '–';
  }
  const reps = set.reps != null ? `${set.reps} ${t('units.reps')}` : '–';
  if (trackingType === 'reps_only' || weightMode === 'none' || set.weightKg == null)
    return reps;

  const suffix =
    weightMode === 'per_hand'
      ? t('setSuffix.perHand')
      : weightMode === 'assistance'
        ? t('setSuffix.assistance')
        : weightMode === 'added_weight'
          ? t('setSuffix.addedWeight')
          : '';
  return `${formatKg(set.weightKg)}${suffix} × ${reps}`;
}
