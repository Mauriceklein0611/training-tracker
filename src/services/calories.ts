import { effectiveSetExecution } from '@/services/equipment';
import type {
  BodyWeightEntry,
  CardioModality,
  SessionExercise,
  WorkoutSet,
} from '@/types';

/**
 * Energy estimation for a workout (#44).
 *
 * Deliberately a *rough estimate*, never a measurement: without a heart rate
 * there is no way to know an individual's real expenditure, so the model is the
 * standard MET approach — `kcal/min = MET × body weight (kg) × 0.0175` — applied
 * to the time that was actually recorded. Everything is derived on read from
 * the stored sets; no kcal value is ever persisted, so a corrected body weight
 * or a fixed set immediately yields a corrected estimate and no historic record
 * is rewritten.
 *
 * Manually recorded cardio calories ({@link WorkoutSet.caloriesKcal}, e.g. read
 * off a machine) always win for their set — a user-entered number is data, not
 * something to override with a model.
 */

/** kcal per minute per kilogram at 1 MET (3.5 ml O₂/kg/min ≈ 5 kcal per litre). */
export const KCAL_PER_MET_MINUTE_PER_KG = 0.0175;

/**
 * Assumed time under load per repetition when a strength set records no
 * duration. Three seconds is a common concentric+eccentric estimate; it only
 * ever affects this estimate, never a stored value.
 */
export const SECONDS_PER_REP = 3;

/** Standing/light activity between sets. */
const REST_MET = 1.5;

/** Resistance training, multiple exercises, moderate-to-vigorous effort. */
const STRENGTH_MET = 5;

/** Isometric holds (plank, dead hang) — strength work, not cardio. */
const HOLD_MET = 4;

/**
 * A rest that was never ended (phone put away, workout paused) must not inflate
 * the estimate, so each single rest is only counted up to ten minutes.
 */
export const MAX_COUNTED_REST_SECONDS = 600;

/** Moderate, steady-state values per cardio activity. */
const CARDIO_MET: Record<CardioModality, number> = {
  running: 9.8,
  walking: 3.5,
  cycling: 7,
  rowing: 7,
  swimming: 7,
  elliptical: 5,
  stair_climbing: 8.8,
  jump_rope: 11,
  other: 6,
};

export interface CalorieEstimate {
  /** Total estimated energy, including the recorded cardio values. */
  kcal: number;
  /** Seconds of actual work the estimate is based on. */
  workSeconds: number;
  /** Seconds of counted rest (capped per rest, see MAX_COUNTED_REST_SECONDS). */
  restSeconds: number;
  /** Part of `kcal` that came from manually recorded cardio values. */
  recordedKcal: number;
}

const EMPTY: CalorieEstimate = {
  kcal: 0,
  workSeconds: 0,
  restSeconds: 0,
  recordedKcal: 0,
};

function kcalFor(met: number, seconds: number, bodyWeightKg: number): number {
  return (met * bodyWeightKg * KCAL_PER_MET_MINUTE_PER_KG * seconds) / 60;
}

/**
 * The body weight that was valid on a given day: the most recent entry recorded
 * on or before that date. Returns null when nothing was recorded by then —
 * an estimate is then simply not shown rather than being based on a guessed or
 * a later weight, which would silently change past workouts.
 */
export function resolveBodyWeightKg(
  entries: Pick<BodyWeightEntry, 'date' | 'weightKg'>[],
  onDate: string,
): number | null {
  const day = onDate.slice(0, 10);
  let best: { date: string; weightKg: number } | null = null;
  for (const entry of entries) {
    if (entry.weightKg == null || !(entry.weightKg > 0)) continue;
    if (entry.date > day) continue;
    if (!best || entry.date > best.date)
      best = { date: entry.date, weightKg: entry.weightKg };
  }
  return best?.weightKg ?? null;
}

/**
 * Estimated energy of one exercise, from its completed sets.
 *
 * Returns null when no body weight is known or nothing was completed — the UI
 * then shows no estimate at all instead of a zero that would read like a fact.
 */
export function estimateExerciseCalories(
  sets: WorkoutSet[],
  context: SessionExercise,
  bodyWeightKg: number | null,
): CalorieEstimate | null {
  if (bodyWeightKg == null || !(bodyWeightKg > 0)) return null;

  const completed = sets.filter((set) => set.completedAt);
  if (completed.length === 0) return null;

  let kcal = 0;
  let recordedKcal = 0;
  let workSeconds = 0;
  let restSeconds = 0;

  for (const set of completed) {
    const execution = effectiveSetExecution(set, context);

    if (execution.trackingType === 'cardio') {
      const seconds = set.durationSeconds ?? 0;
      workSeconds += seconds;
      if (set.caloriesKcal != null && set.caloriesKcal > 0) {
        // Recorded on the machine or by a watch — used as it is.
        recordedKcal += set.caloriesKcal;
        kcal += set.caloriesKcal;
      } else {
        const met = CARDIO_MET[execution.cardioModality ?? 'other'] ?? CARDIO_MET.other;
        kcal += kcalFor(met, seconds, bodyWeightKg);
      }
    } else {
      const seconds =
        set.durationSeconds ?? (set.reps != null ? set.reps * SECONDS_PER_REP : 0);
      workSeconds += seconds;
      kcal += kcalFor(
        execution.trackingType === 'duration' ? HOLD_MET : STRENGTH_MET,
        seconds,
        bodyWeightKg,
      );
    }

    const rest = Math.min(set.restActualSeconds ?? 0, MAX_COUNTED_REST_SECONDS);
    if (rest > 0) {
      restSeconds += rest;
      kcal += kcalFor(REST_MET, rest, bodyWeightKg);
    }
  }

  return { kcal, workSeconds, restSeconds, recordedKcal };
}

/** Sum of the per-exercise estimates of a whole workout. */
export function estimateSessionCalories(
  entries: Array<{ sets: WorkoutSet[]; context: SessionExercise }>,
  bodyWeightKg: number | null,
): CalorieEstimate | null {
  if (bodyWeightKg == null || !(bodyWeightKg > 0)) return null;

  let total: CalorieEstimate | null = null;
  for (const entry of entries) {
    const estimate = estimateExerciseCalories(entry.sets, entry.context, bodyWeightKg);
    if (!estimate) continue;
    const base: CalorieEstimate = total ?? EMPTY;
    total = {
      kcal: base.kcal + estimate.kcal,
      workSeconds: base.workSeconds + estimate.workSeconds,
      restSeconds: base.restSeconds + estimate.restSeconds,
      recordedKcal: base.recordedKcal + estimate.recordedKcal,
    };
  }
  return total;
}
