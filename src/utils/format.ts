import type { BodyMeasurements, SetType, TrackingType, WeightMode } from '@/types';

/** German UI labels for the domain enums, in one place. */

export const TRACKING_TYPE_LABELS: Record<TrackingType, string> = {
  weight_reps: 'Gewicht + Wiederholungen',
  bodyweight_reps: 'Körpergewicht',
  assisted_bodyweight_reps: 'Unterstützt',
  reps_only: 'Nur Wiederholungen',
  duration: 'Zeit',
};

export const TRACKING_TYPE_HELP: Record<TrackingType, string> = {
  weight_reps: 'Externes Gewicht und Wiederholungen, z. B. Bankdrücken oder Kurzhantelcurls.',
  bodyweight_reps: 'Eigengewicht mit optionalem Zusatzgewicht, z. B. Klimmzüge oder Dips.',
  assisted_bodyweight_reps:
    'Unterstützte Eigengewichtsübung, z. B. Klimmzüge an der Maschine oder mit Band.',
  reps_only: 'Nur Wiederholungen ohne sinnvolle Last, z. B. TRX-Rudern oder Mobilität.',
  duration: 'Zeit statt Wiederholungen, z. B. Plank oder Dead Hang.',
};

export const WEIGHT_MODE_LABELS: Record<WeightMode, string> = {
  per_hand: 'Je Hand',
  total: 'Gesamt',
  added_weight: 'Zusatzgewicht',
  assistance: 'Unterstützung',
  none: 'Kein Gewicht',
};

export const WEIGHT_MODE_HELP: Record<WeightMode, string> = {
  per_hand: 'Der eingetragene Wert gilt pro Hantel. Der Multiplikator bestimmt die Gesamtlast.',
  total: 'Der eingetragene Wert ist bereits die Gesamtlast, z. B. Langhantel inklusive Stange.',
  added_weight: 'Zusätzliches Gewicht zum Körpergewicht, z. B. Gewichtsgürtel.',
  assistance: 'Unterstützung, die die Last verringert, z. B. Gegengewicht an der Maschine.',
  none: 'Für diese Übung wird kein Gewicht erfasst.',
};

export const SET_TYPE_LABELS: Record<SetType, string> = {
  warmup: 'Aufwärmsatz',
  working: 'Arbeitssatz',
  drop: 'Dropsatz',
  failure: 'Bis Versagen',
};

export const SET_TYPE_SHORT: Record<SetType, string> = {
  warmup: 'A',
  working: 'W',
  drop: 'D',
  failure: 'V',
};

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
  return `${(Math.round(value * 10) / 10).toLocaleString('de-DE', {
    maximumFractionDigits: 1,
  })} cm`;
}

/** Formats a body fat percentage: "17,5 %". */
export function formatPercentValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '–';
  return `${(Math.round(value * 10) / 10).toLocaleString('de-DE', {
    maximumFractionDigits: 1,
  })} %`;
}

/** Formats a weight with at most one decimal: "42,5 kg". */
export function formatKg(value: number | null | undefined, withUnit = true): string {
  if (value == null || !Number.isFinite(value)) return '–';
  const rounded = Math.round(value * 10) / 10;
  const text = rounded.toLocaleString('de-DE', { maximumFractionDigits: 1 });
  return withUnit ? `${text} kg` : text;
}

/** Larger volumes are shown in tonnes to stay readable on a phone. */
export function formatVolume(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value === 0) return '–';
  if (value >= 10000) {
    return `${(value / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} t`;
  }
  return formatKg(value);
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return '–';
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
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
  const reps = set.reps != null ? `${set.reps} Wdh.` : '–';
  if (trackingType === 'reps_only' || weightMode === 'none' || set.weightKg == null) return reps;

  const suffix =
    weightMode === 'per_hand'
      ? '/Hand'
      : weightMode === 'assistance'
        ? ' Unterst.'
        : weightMode === 'added_weight'
          ? ' Zusatz'
          : '';
  return `${formatKg(set.weightKg)}${suffix} × ${reps}`;
}
