import type { ProgressionMethod, SessionExercise, WorkoutSet } from '@/types';
import { isWorkingSet } from '@/services/metrics';

/**
 * Local, rule-based progression suggestions.
 *
 * No AI and no server: a handful of transparent rules over the last session's
 * working sets. The result is *always* a suggestion with a stated reason —
 * nothing here ever writes to a set or changes a plan.
 *
 * The rules, in order:
 *
 * 1. Not enough usable data           → "insufficient_data", say so plainly
 * 2. Every set hit the top of the rep range, and the reserve was at least the
 *    target RIR (if RIR was recorded) → "increase_weight"
 * 3. Every set landed inside the range → "add_reps" (same weight, one more rep)
 * 4. Two or more sets fell below the range → "reduce_weight"
 * 5. Anything else (mixed picture)    → "hold"
 *
 * Weights are handled in the unit the user *enters*, not the computed total
 * load: for a per-hand exercise a suggestion of 22.5 kg means 22.5 kg per
 * dumbbell, which is what the input field expects.
 */

export type ProgressionAction =
  'increase_weight' | 'add_reps' | 'hold' | 'reduce_weight' | 'insufficient_data';

export interface ProgressionSuggestion {
  action: ProgressionAction;
  /** Short recommendation, e.g. "Gewicht erhöhen". */
  headline: string;
  /** Why — always shown, so the suggestion can be judged rather than obeyed. */
  reason: string;
  /** Proposed weight in the exercise's own entry unit. */
  suggestedWeightKg?: number;
  suggestedReps?: number;
  /** Sets the suggestion is based on. */
  consideredSets: number;
}

export interface ProgressionConfig {
  targetRepMin?: number;
  targetRepMax?: number;
  /** Reps in reserve aimed for; only used when RIR was actually recorded. */
  targetRir?: number;
  /** Smallest sensible jump, used when no plate list is configured. */
  weightIncrementKg?: number;
  /** Actual selectable weights, e.g. the dumbbell rack. */
  availableWeightsKg?: number[];
  /** "reps" keeps the load and grows repetitions even for weighted work. */
  progressionMethod?: ProgressionMethod;
}

export const DEFAULT_WEIGHT_INCREMENT_KG = 2.5;

/** Minimum number of comparable working sets before any advice is given. */
export const MIN_SETS_FOR_SUGGESTION = 2;

/**
 * Next weight that can actually be loaded.
 *
 * With a configured weight list only a real entry is proposed — suggesting
 * 42.5 kg when the rack jumps 40 → 45 would be useless advice.
 */
export function nextWeightUp(
  current: number,
  config: Pick<ProgressionConfig, 'availableWeightsKg' | 'weightIncrementKg'>,
): number | null {
  const available =
    config.availableWeightsKg?.filter((weight) => Number.isFinite(weight)) ?? [];
  if (available.length > 0) {
    const heavier = available.filter((weight) => weight > current).sort((a, b) => a - b);
    return heavier[0] ?? null; // already at the top of the rack
  }
  const increment = config.weightIncrementKg ?? DEFAULT_WEIGHT_INCREMENT_KG;
  return Math.round((current + increment) * 100) / 100;
}

export function nextWeightDown(
  current: number,
  config: Pick<ProgressionConfig, 'availableWeightsKg' | 'weightIncrementKg'>,
): number | null {
  const available =
    config.availableWeightsKg?.filter((weight) => Number.isFinite(weight)) ?? [];
  if (available.length > 0) {
    const lighter = available.filter((weight) => weight < current).sort((a, b) => b - a);
    return lighter[0] ?? null;
  }
  const increment = config.weightIncrementKg ?? DEFAULT_WEIGHT_INCREMENT_KG;
  const next = Math.round((current - increment) * 100) / 100;
  return next > 0 ? next : null;
}

function insufficient(reason: string, consideredSets = 0): ProgressionSuggestion {
  return {
    action: 'insufficient_data',
    headline: 'Noch nicht genügend Daten',
    reason,
    consideredSets,
  };
}

/**
 * Suggests how to progress an exercise next time.
 *
 * `sets` should be the working sets of the most recent session for one
 * exercise. Warm-ups are filtered out here; drop sets and sets to failure are
 * excluded from the *basis* because their rep counts do not describe the
 * working load.
 */
export function suggestProgression(
  sets: WorkoutSet[],
  context: Pick<SessionExercise, 'trackingTypeSnapshot' | 'weightModeSnapshot'>,
  config: ProgressionConfig,
): ProgressionSuggestion {
  const type = context.trackingTypeSnapshot;

  if (type === 'duration') {
    const timed = sets.filter(
      (set) => set.completedAt && isWorkingSet(set) && set.durationSeconds != null,
    );
    if (timed.length === 0) {
      return insufficient('Für diese Übung wurden noch keine Zeiten erfasst.');
    }
    const best = Math.max(...timed.map((set) => set.durationSeconds ?? 0));
    return {
      action: 'add_reps',
      headline: 'Haltezeit steigern',
      reason: `Längster Satz zuletzt ${Math.round(best)} Sekunden. Versuche beim nächsten Mal etwas länger zu halten.`,
      consideredSets: timed.length,
    };
  }

  // Only plain working sets describe the working load; drop and failure sets
  // deliberately end differently and would distort the picture.
  const basis = sets.filter(
    (set) => set.completedAt && set.setType === 'working' && set.reps != null,
  );

  if (basis.length < MIN_SETS_FOR_SUGGESTION) {
    return insufficient(
      `Es liegen erst ${basis.length} vollständige Arbeitssätze vor. ` +
        `Ab ${MIN_SETS_FOR_SUGGESTION} Sätzen entsteht eine Empfehlung.`,
      basis.length,
    );
  }

  const { targetRepMin, targetRepMax } = config;
  if (targetRepMin == null || targetRepMax == null) {
    return insufficient(
      'Für diese Übung ist kein Ziel-Wiederholungsbereich hinterlegt. ' +
        'Trage ihn im Trainingsplan ein, damit eine Empfehlung möglich wird.',
      basis.length,
    );
  }

  const reps = basis.map((set) => set.reps as number);
  const atOrAboveMax = reps.every((value) => value >= targetRepMax);
  const withinRange = reps.every(
    (value) => value >= targetRepMin && value <= targetRepMax,
  );
  const belowMin = reps.filter((value) => value < targetRepMin).length;

  // RIR is optional; when it is missing the rule simply does not apply.
  const rirValues = basis
    .map((set) => set.rir)
    .filter((value): value is number => value != null);
  const averageRir =
    rirValues.length > 0
      ? rirValues.reduce((sum, value) => sum + value, 0) / rirValues.length
      : null;
  /*
   * RIR counts the repetitions left in reserve, so a *higher* value means the
   * set was easier. Adding load is only appropriate when at least the target
   * reserve was still there — an average below the target means the sets were
   * already harder than intended.
   */
  const rirSatisfied =
    config.targetRir == null || averageRir == null || averageRir >= config.targetRir;

  const weights = basis
    .map((set) => set.weightKg)
    .filter((value): value is number => value != null);
  const topWeight = weights.length > 0 ? Math.max(...weights) : null;
  const weighted = type === 'weight_reps' || context.weightModeSnapshot !== 'none';

  const rirNote =
    averageRir == null
      ? ' RIR wurde nicht erfasst und daher nicht berücksichtigt.'
      : ` Durchschnittlicher RIR: ${Math.round(averageRir * 10) / 10}.`;

  // ---- rule 2: ready for more load ------------------------------------
  if (atOrAboveMax && rirSatisfied) {
    // An explicit "reps" preference keeps the load even where more could be added.
    const preferReps = config.progressionMethod === 'reps';
    if (weighted && topWeight != null && !preferReps) {
      const next = nextWeightUp(topWeight, config);
      if (next != null) {
        return {
          action: 'increase_weight',
          headline: 'Gewicht beim nächsten Mal erhöhen',
          reason:
            `Alle ${basis.length} Arbeitssätze haben die obere Grenze von ` +
            `${targetRepMax} Wiederholungen erreicht.${rirNote}`,
          suggestedWeightKg: next,
          consideredSets: basis.length,
        };
      }
      return {
        action: 'hold',
        headline: 'Gewicht beibehalten',
        reason:
          'Der Wiederholungsbereich ist ausgereizt, aber es ist kein schwereres ' +
          'Gewicht hinterlegt. Ergänze die verfügbaren Gewichte in der Übung.',
        consideredSets: basis.length,
      };
    }
    // Bodyweight and reps-only: more repetitions is the progression.
    return {
      action: 'add_reps',
      headline: 'Wiederholungen steigern',
      reason:
        `Alle ${basis.length} Arbeitssätze haben ${targetRepMax} Wiederholungen ` +
        `erreicht.${rirNote} Ohne Zusatzgewicht führt der Weg über mehr Wiederholungen.`,
      suggestedReps: targetRepMax + 1,
      consideredSets: basis.length,
    };
  }

  // ---- rule 3: inside the range ---------------------------------------
  if (withinRange) {
    return {
      action: 'add_reps',
      headline: 'Gewicht halten, eine Wiederholung ergänzen',
      reason:
        `Alle Sätze liegen im Zielbereich ${targetRepMin}–${targetRepMax}.` +
        `${rirNote} Steigere zuerst die Wiederholungen, bevor du das Gewicht erhöhst.`,
      suggestedWeightKg: topWeight ?? undefined,
      suggestedReps: Math.min(targetRepMax, Math.max(...reps) + 1),
      consideredSets: basis.length,
    };
  }

  // ---- rule 4: clearly too heavy --------------------------------------
  if (belowMin >= 2) {
    const suggestion: ProgressionSuggestion = {
      action: 'reduce_weight',
      headline: 'Eventuell Gewicht leicht reduzieren',
      reason:
        `${belowMin} Sätze lagen unter der unteren Grenze von ${targetRepMin} ` +
        `Wiederholungen.${rirNote} Etwas weniger Gewicht kann helfen, den ` +
        'Zielbereich wieder zu treffen.',
      consideredSets: basis.length,
    };
    if (weighted && topWeight != null) {
      const down = nextWeightDown(topWeight, config);
      if (down != null) suggestion.suggestedWeightKg = down;
    }
    return suggestion;
  }

  // ---- rule 5: mixed --------------------------------------------------
  return {
    action: 'hold',
    headline: 'Zunächst im aktuellen Wiederholungsbereich bleiben',
    reason:
      `Die Sätze liegen uneinheitlich um den Zielbereich ${targetRepMin}–${targetRepMax}.` +
      `${rirNote} Halte das Gewicht und arbeite auf gleichmäßige Sätze hin.`,
    suggestedWeightKg: topWeight ?? undefined,
    consideredSets: basis.length,
  };
}
