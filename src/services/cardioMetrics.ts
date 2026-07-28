import type { CardioModality, SessionExercise, WorkoutSet } from '@/types';
import { effectiveSetExecution } from '@/services/equipment';
import { isCompleted } from '@/services/metrics';
import { paceKindFor, prefersMeters, type PaceKind } from '@/services/cardio';

/**
 * Pure cardio metrics — deliberately kept apart from the strength metrics
 * (volume, 1RM). Nothing here is ever mixed into a kilogram figure, and no
 * value is invented: pace/speed exist only when both duration and distance are
 * present and positive, and aggregates come from raw totals, never from
 * averaging derived numbers. No medical interpretation of any value.
 */

/** Whether a completed set is a cardio activity by its effective execution. */
export function isCardioSet(set: WorkoutSet, context: SessionExercise): boolean {
  return effectiveSetExecution(set, context).trackingType === 'cardio';
}

/**
 * Minimum distance (metres) below which a pace best is not claimed, so a very
 * short operating error can never produce an absurd "fastest pace". Central and
 * tested; keyed by the pace convention.
 */
export const MIN_DISTANCE_FOR_PACE_M: Record<Exclude<PaceKind, 'none'>, number> = {
  min_per_km: 400,
  per_500m: 250,
  per_100m: 50,
  km_per_h: 400,
};

export interface Pace {
  kind: Exclude<PaceKind, 'none'>;
  /**
   * The value in the convention's own unit: minutes for min_per_km, seconds for
   * per_500m / per_100m, km/h for km_per_h.
   */
  value: number;
}

/**
 * Pace / speed for one duration+distance pair, in the modality's convention.
 * Returns null unless both are present and positive, or the modality has no
 * meaningful distance-based pace.
 */
export function computePace(
  modality: CardioModality | undefined,
  durationSeconds: number | undefined,
  distanceMeters: number | undefined,
): Pace | null {
  const kind = paceKindFor(modality);
  if (kind === 'none') return null;
  if (
    durationSeconds == null ||
    distanceMeters == null ||
    !(durationSeconds > 0) ||
    !(distanceMeters > 0)
  ) {
    return null;
  }
  return { kind, value: paceValue(kind, durationSeconds, distanceMeters) };
}

function paceValue(
  kind: Exclude<PaceKind, 'none'>,
  durationSeconds: number,
  distanceMeters: number,
): number {
  const km = distanceMeters / 1000;
  switch (kind) {
    case 'min_per_km':
      return durationSeconds / 60 / km;
    case 'per_500m':
      return durationSeconds / (distanceMeters / 500);
    case 'per_100m':
      return durationSeconds / (distanceMeters / 100);
    case 'km_per_h':
      return km / (durationSeconds / 3600);
  }
}

/** Whether a pace of this kind is "better" when the number is lower (time-based). */
export function paceLowerIsBetter(kind: Exclude<PaceKind, 'none'>): boolean {
  return kind !== 'km_per_h';
}

export interface CardioTotals {
  /** Completed cardio sections (intervals) counted. */
  activities: number;
  totalDurationSeconds: number;
  totalDistanceMeters: number;
  totalCaloriesKcal: number;
  totalElevationGainMeters: number;
  /** Duration-weighted mean of the recorded heart rates, from present values only. */
  averageHeartRateBpm: number | null;
}

export function emptyCardioTotals(): CardioTotals {
  return {
    activities: 0,
    totalDurationSeconds: 0,
    totalDistanceMeters: 0,
    totalCaloriesKcal: 0,
    totalElevationGainMeters: 0,
    averageHeartRateBpm: null,
  };
}

/**
 * Aggregates completed cardio sets. Heart rate is a duration-weighted mean over
 * only the sets that recorded one (a section without a value is ignored, never
 * treated as 0). Distance/calories/elevation sum raw present values.
 */
export function aggregateCardio(
  entries: { set: WorkoutSet; context: SessionExercise }[],
): CardioTotals {
  const totals = emptyCardioTotals();
  let hrWeightedSum = 0;
  let hrWeight = 0;

  for (const { set, context } of entries) {
    if (!isCompleted(set) || !isCardioSet(set, context)) continue;
    totals.activities += 1;
    totals.totalDurationSeconds += set.durationSeconds ?? 0;
    totals.totalDistanceMeters += set.distanceMeters ?? 0;
    totals.totalCaloriesKcal += set.caloriesKcal ?? 0;
    totals.totalElevationGainMeters += set.elevationGainMeters ?? 0;

    if (set.averageHeartRateBpm != null && set.durationSeconds != null) {
      hrWeightedSum += set.averageHeartRateBpm * set.durationSeconds;
      hrWeight += set.durationSeconds;
    }
  }

  if (hrWeight > 0) {
    totals.averageHeartRateBpm = hrWeightedSum / hrWeight;
  }
  return totals;
}

/**
 * Aggregate pace for a set of cardio sections of *one* modality, computed as
 * total duration / total distance (never the mean of individual paces). Returns
 * null when the modality has no distance-based pace or totals are non-positive.
 * Callers must only pass sections of a single, compatible modality.
 */
export function aggregatePace(
  modality: CardioModality | undefined,
  totalDurationSeconds: number,
  totalDistanceMeters: number,
): Pace | null {
  return computePace(modality, totalDurationSeconds, totalDistanceMeters);
}

export interface CardioRecords {
  longestDurationSeconds: number | null;
  greatestDistanceMeters: number | null;
  /** Fastest recorded pace, only above the modality's minimum distance. */
  bestPace: Pace | null;
}

/**
 * Cardio bests for completed sets that all share one modality. Pace bests are
 * only considered above {@link MIN_DISTANCE_FOR_PACE_M} for the pace kind, so an
 * accidental 5 m sprint never becomes a record. Descriptions elsewhere label
 * these as "fastest recorded pace" — never as a fitness or health claim.
 */
export function computeCardioRecords(
  modality: CardioModality | undefined,
  entries: { set: WorkoutSet; context: SessionExercise }[],
): CardioRecords {
  const records: CardioRecords = {
    longestDurationSeconds: null,
    greatestDistanceMeters: null,
    bestPace: null,
  };
  const kind = paceKindFor(modality);
  const minDistance = kind === 'none' ? Infinity : MIN_DISTANCE_FOR_PACE_M[kind];

  for (const { set, context } of entries) {
    if (!isCompleted(set) || !isCardioSet(set, context)) continue;

    if (
      set.durationSeconds != null &&
      set.durationSeconds > 0 &&
      (records.longestDurationSeconds == null ||
        set.durationSeconds > records.longestDurationSeconds)
    ) {
      records.longestDurationSeconds = set.durationSeconds;
    }
    if (
      set.distanceMeters != null &&
      set.distanceMeters > 0 &&
      (records.greatestDistanceMeters == null ||
        set.distanceMeters > records.greatestDistanceMeters)
    ) {
      records.greatestDistanceMeters = set.distanceMeters;
    }

    if (kind !== 'none' && (set.distanceMeters ?? 0) >= minDistance) {
      const pace = computePace(modality, set.durationSeconds, set.distanceMeters);
      if (pace) {
        const better =
          records.bestPace == null ||
          (paceLowerIsBetter(kind)
            ? pace.value < records.bestPace.value
            : pace.value > records.bestPace.value);
        if (better) records.bestPace = pace;
      }
    }
  }
  return records;
}

// ---- formatting -------------------------------------------------------

/** Whole seconds as "M:SS" (or "H:MM:SS" past an hour). */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

/** Distance in the modality's display unit (km, or m for rowing/swimming). */
export function formatCardioDistance(
  meters: number,
  modality: CardioModality | undefined,
): string {
  if (prefersMeters(modality)) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  // Trim to at most two decimals without trailing zeros.
  return `${parseFloat(km.toFixed(2))} km`;
}

/** A pace/speed in its convention's unit, e.g. "5:00 min/km", "30 km/h". */
export function formatPace(pace: Pace): string {
  switch (pace.kind) {
    case 'min_per_km': {
      const minutes = Math.floor(pace.value);
      const seconds = Math.round((pace.value - minutes) * 60);
      const shown =
        seconds === 60
          ? `${minutes + 1}:00`
          : `${minutes}:${String(seconds).padStart(2, '0')}`;
      return `${shown} min/km`;
    }
    case 'per_500m':
      return `${formatDuration(pace.value)} /500 m`;
    case 'per_100m':
      return `${formatDuration(pace.value)} /100 m`;
    case 'km_per_h':
      return `${parseFloat(pace.value.toFixed(1))} km/h`;
  }
}

/**
 * One-line summary of a completed cardio section: duration, distance and — when
 * both are present — the modality's pace/speed. Missing values are simply
 * omitted; nothing is invented.
 */
export function describeCardioSet(
  set: Pick<WorkoutSet, 'durationSeconds' | 'distanceMeters'>,
  modality: CardioModality | undefined,
): string {
  const parts: string[] = [];
  if (set.durationSeconds != null && set.durationSeconds > 0) {
    parts.push(formatDuration(set.durationSeconds));
  }
  if (set.distanceMeters != null && set.distanceMeters > 0) {
    parts.push(formatCardioDistance(set.distanceMeters, modality));
  }
  const pace = computePace(modality, set.durationSeconds, set.distanceMeters);
  if (pace) parts.push(formatPace(pace));
  return parts.length > 0 ? parts.join(' · ') : '–';
}
