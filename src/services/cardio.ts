import type { CardioModality, Equipment } from '@/types';

/**
 * Cardio domain helpers: stable modality metadata, unit formatting and the
 * modality-specific pace/speed convention. Pure and language-neutral internally;
 * German labels live here. Nothing medical is computed or claimed.
 */

/** Selectable cardio modalities in display order. */
export const CARDIO_MODALITY_VALUES: CardioModality[] = [
  'running',
  'walking',
  'cycling',
  'rowing',
  'swimming',
  'elliptical',
  'stair_climbing',
  'jump_rope',
  'other',
];

export const CARDIO_MODALITY_LABELS: Record<CardioModality, string> = {
  running: 'Laufen',
  walking: 'Gehen',
  cycling: 'Radfahren',
  rowing: 'Rudern',
  swimming: 'Schwimmen',
  elliptical: 'Crosstrainer',
  stair_climbing: 'Treppensteigen',
  jump_rope: 'Seilspringen',
  other: 'Sonstiges',
};

/** German + English search synonyms per modality, for the exercise picker. */
export const CARDIO_MODALITY_SYNONYMS: Record<CardioModality, string[]> = {
  running: ['laufen', 'joggen', 'run', 'running', 'jog'],
  walking: ['gehen', 'walking', 'walk', 'spazieren'],
  cycling: ['radfahren', 'fahrrad', 'cycling', 'bike', 'rad', 'ergometer'],
  rowing: ['rudern', 'rowing', 'row', 'ergo'],
  swimming: ['schwimmen', 'swimming', 'swim', 'pool'],
  elliptical: ['crosstrainer', 'elliptical', 'ellipsentrainer'],
  stair_climbing: ['treppen', 'stairmaster', 'stair', 'stairclimber', 'stepper'],
  jump_rope: ['seilspringen', 'springseil', 'jump rope', 'rope', 'seil'],
  other: ['cardio', 'ausdauer'],
};

export function cardioModalityLabel(modality: CardioModality | undefined): string {
  return CARDIO_MODALITY_LABELS[modality ?? 'other'];
}

/** How pace / speed is expressed for a modality. */
export type PaceKind =
  /** minutes per kilometre (running, walking, treadmill). */
  | 'min_per_km'
  /** time per 500 m (rowing). */
  | 'per_500m'
  /** time per 100 m (swimming). */
  | 'per_100m'
  /** kilometres per hour (cycling). */
  | 'km_per_h'
  /** no meaningful distance-based pace (jump rope, stair climbing, other). */
  | 'none';

/**
 * The pace convention for a modality. Distance-less activities (jump rope,
 * stair climbing) report `none`, so no pace is ever invented for them.
 */
export function paceKindFor(modality: CardioModality | undefined): PaceKind {
  switch (modality) {
    case 'running':
    case 'walking':
      return 'min_per_km';
    case 'cycling':
      return 'km_per_h';
    case 'rowing':
      return 'per_500m';
    case 'swimming':
      return 'per_100m';
    case 'elliptical':
    case 'stair_climbing':
    case 'jump_rope':
    case 'other':
    case undefined:
      return 'none';
  }
}

/** Whether a modality's distance is more naturally shown in metres than km. */
export function prefersMeters(modality: CardioModality | undefined): boolean {
  return modality === 'rowing' || modality === 'swimming';
}

/** Suggested default cardio device for a modality (a starting point only). */
export function defaultEquipmentForModality(modality: CardioModality): Equipment {
  switch (modality) {
    case 'running':
    case 'walking':
      return 'treadmill';
    case 'cycling':
      return 'ergometer';
    case 'rowing':
      return 'rowing_machine';
    case 'elliptical':
      return 'elliptical';
    case 'stair_climbing':
      return 'stair_climber';
    case 'swimming':
      return 'pool';
    case 'jump_rope':
      return 'jump_rope';
    case 'other':
      return 'unspecified';
  }
}
