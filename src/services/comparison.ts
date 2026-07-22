import type { SessionExercise, SetType, WorkoutSet } from '@/types';
import { effectiveLoadKg, estimatedOneRepMax } from '@/services/metrics';
import { formatKg, formatNumber } from '@/utils/format';

/**
 * Comparing the set being entered against the same set of the previous workout.
 *
 * Read-only throughout: nothing here ever writes, and a comparison never
 * changes a recorded set.
 *
 * Two rules keep the comparison honest:
 *
 * - **Like for like.** Set 1 is compared with set 1, set 2 with set 2, and only
 *   within the same set type. Comparing a working set against last week's
 *   warm-up would produce a flattering, meaningless number.
 * - **Direction depends on the exercise.** For assisted exercises *less*
 *   assistance is progress, so the sign is inverted there. Everywhere else more
 *   is better.
 */

export type MatchQuality = 'same-position' | 'last-working-set';

export interface PreviousSetMatch {
  set: WorkoutSet;
  matchedBy: MatchQuality;
}

/**
 * Finds the set of the previous workout to compare against.
 *
 * `ordinalWithinType` is the 0-based index of the current set *among sets of
 * the same type* in this workout — so the second working set looks for the
 * second working set last time, regardless of interleaved warm-ups.
 */
export function findPreviousSetForComparison(
  previousSets: WorkoutSet[],
  current: { setType: SetType; ordinalWithinType: number },
): PreviousSetMatch | null {
  const sameType = previousSets
    .filter((set) => set.setType === current.setType && set.completedAt)
    .sort((a, b) => a.position - b.position);

  const exact = sameType[current.ordinalWithinType];
  if (exact) return { set: exact, matchedBy: 'same-position' };

  // No matching set last time — fall back to the final working set, which is
  // the closest thing to "what I managed last time". Warm-ups get no fallback:
  // there is nothing meaningful to compare them to.
  if (current.setType === 'warmup') return null;

  const working = previousSets
    .filter((set) => set.setType === 'working' && set.completedAt)
    .sort((a, b) => a.position - b.position);
  const last = working[working.length - 1];
  return last ? { set: last, matchedBy: 'last-working-set' } : null;
}

export type DeltaDirection = 'better' | 'worse' | 'equal';

export interface ComparisonDelta {
  label: string;
  direction: DeltaDirection;
}

export interface SetComparison {
  previous: WorkoutSet;
  matchedBy: MatchQuality;
  /** One-line description of the previous set, e.g. "80 kg × 8". */
  previousSummary: string;
  /** Differences worth showing; empty when nothing changed. */
  deltas: ComparisonDelta[];
  /** True when the current values beat everything recorded before. */
  isRecord: boolean;
}

/** Best values recorded before this workout, used for the "new best" badge. */
export interface RecordBaseline {
  bestLoadKg?: number | null;
  bestOneRepMaxKg?: number | null;
  bestReps?: number | null;
  bestDurationSeconds?: number | null;
}

/** Context needed to evaluate a historical set with its own conventions. */
export type RecordContext = Pick<
  SessionExercise,
  'trackingTypeSnapshot' | 'weightModeSnapshot' | 'weightMultiplierSnapshot'
>;

export interface RecordEntry {
  set: WorkoutSet;
  context: RecordContext;
}

export interface ComparableValues {
  weightKg?: number;
  reps?: number;
  durationSeconds?: number;
}

function describeDelta(
  current: number,
  previous: number,
  unit: 'kg' | 'reps' | 'seconds',
  /** Set for metrics where a lower number is the better result. */
  lowerIsBetter = false,
): ComparisonDelta | null {
  const diff = current - previous;
  // Guard against floating point noise on weights like 22.5.
  if (Math.abs(diff) < 0.001) return null;

  const improved = lowerIsBetter ? diff < 0 : diff > 0;
  const sign = diff > 0 ? '+' : '−';
  const magnitude = Math.abs(diff);

  const label =
    unit === 'kg'
      ? `${sign}${formatKg(magnitude)}`
      : unit === 'reps'
        ? `${sign}${formatNumber(magnitude)} Wdh.`
        : `${sign}${formatNumber(Math.round(magnitude))} s`;

  return { label, direction: improved ? 'better' : 'worse' };
}

/** Short description of a set, matching how the live view renders one. */
function summarise(
  set: ComparableValues,
  context: Pick<SessionExercise, 'trackingTypeSnapshot' | 'weightModeSnapshot'>,
): string {
  const { trackingTypeSnapshot: type, weightModeSnapshot: mode } = context;

  if (type === 'duration') {
    return set.durationSeconds != null ? `${Math.round(set.durationSeconds)} s` : '–';
  }
  const reps = set.reps != null ? `${set.reps} Wdh.` : '–';
  if (type === 'reps_only' || mode === 'none' || set.weightKg == null) return reps;

  const suffix =
    mode === 'per_hand'
      ? '/Hand'
      : mode === 'assistance'
        ? ' Unterst.'
        : mode === 'added_weight'
          ? ' Zusatz'
          : '';
  return `${formatKg(set.weightKg)}${suffix} × ${reps}`;
}

/**
 * Compares the values being entered with the matched previous set.
 *
 * Returns `null` when the current set has nothing comparable filled in yet, so
 * the UI stays quiet until there is something to say.
 */
export function compareSet(
  current: ComparableValues,
  match: PreviousSetMatch,
  context: Pick<
    SessionExercise,
    'trackingTypeSnapshot' | 'weightModeSnapshot' | 'weightMultiplierSnapshot'
  >,
  baseline: RecordBaseline = {},
): SetComparison | null {
  const previous = match.set;
  const type = context.trackingTypeSnapshot;
  const deltas: ComparisonDelta[] = [];

  if (type === 'duration') {
    if (current.durationSeconds == null) return null;
    if (previous.durationSeconds != null) {
      const delta = describeDelta(current.durationSeconds, previous.durationSeconds, 'seconds');
      if (delta) deltas.push(delta);
    }
  } else {
    if (current.reps == null) return null;

    // Weight first: it is the headline number for weighted work.
    if (type === 'weight_reps') {
      const currentLoad = effectiveLoadKg({ weightKg: current.weightKg }, context);
      const previousLoad = effectiveLoadKg(previous, context);
      if (currentLoad != null && previousLoad != null) {
        const delta = describeDelta(currentLoad, previousLoad, 'kg');
        if (delta) deltas.push(delta);
      }
    } else if (current.weightKg != null && previous.weightKg != null) {
      // Bodyweight: added weight up is better, assistance down is better.
      const lowerIsBetter = context.weightModeSnapshot === 'assistance';
      const delta = describeDelta(current.weightKg, previous.weightKg, 'kg', lowerIsBetter);
      if (delta) deltas.push(delta);
    }

    if (previous.reps != null) {
      const delta = describeDelta(current.reps, previous.reps, 'reps');
      if (delta) deltas.push(delta);
    }
  }

  return {
    previous,
    matchedBy: match.matchedBy,
    previousSummary: summarise(previous, context),
    deltas,
    isRecord: isNewRecord(current, context, baseline),
  };
}

/**
 * Whether the current values beat every earlier result.
 *
 * Deliberately conservative: only the metric that actually defines progress for
 * this tracking type counts, and a missing baseline means "no claim", not
 * "record".
 */
export function isNewRecord(
  current: ComparableValues,
  context: Pick<
    SessionExercise,
    'trackingTypeSnapshot' | 'weightModeSnapshot' | 'weightMultiplierSnapshot'
  >,
  baseline: RecordBaseline,
): boolean {
  const type = context.trackingTypeSnapshot;

  if (type === 'duration') {
    if (current.durationSeconds == null || baseline.bestDurationSeconds == null) return false;
    return current.durationSeconds > baseline.bestDurationSeconds;
  }

  if (type === 'weight_reps') {
    // A weighted record is beating either the heaviest load or the best
    // estimated 1RM recorded before — whichever the current set exceeds.
    const load = effectiveLoadKg({ weightKg: current.weightKg }, context);
    const loadRecord =
      load != null && baseline.bestLoadKg != null && load > baseline.bestLoadKg;

    const oneRm = estimatedOneRepMax(
      { weightKg: current.weightKg, reps: current.reps } as WorkoutSet,
      context,
    );
    const oneRmRecord =
      oneRm != null && baseline.bestOneRepMaxKg != null && oneRm > baseline.bestOneRepMaxKg;

    return loadRecord || oneRmRecord;
  }

  // Bodyweight, assisted and reps-only progress through repetitions.
  if (current.reps == null || baseline.bestReps == null) return false;
  return current.reps > baseline.bestReps;
}

/**
 * Baseline from previously completed sets of one exercise.
 *
 * Each set is evaluated with *its own* recorded convention (weight mode and
 * multiplier), so a record stays correct even if the exercise was later switched
 * from e.g. total weight to per-hand. The estimated 1RM is tracked as well.
 */
export function buildRecordBaseline(entries: RecordEntry[]): RecordBaseline {
  const baseline: RecordBaseline = {};

  for (const { set, context } of entries) {
    if (!set.completedAt || set.setType === 'warmup') continue;

    const load = effectiveLoadKg(set, context);
    if (load != null && (baseline.bestLoadKg == null || load > baseline.bestLoadKg)) {
      baseline.bestLoadKg = load;
    }
    const oneRm = estimatedOneRepMax(set, context);
    if (oneRm != null && (baseline.bestOneRepMaxKg == null || oneRm > baseline.bestOneRepMaxKg)) {
      baseline.bestOneRepMaxKg = oneRm;
    }
    if (set.reps != null && (baseline.bestReps == null || set.reps > baseline.bestReps)) {
      baseline.bestReps = set.reps;
    }
    if (
      set.durationSeconds != null &&
      (baseline.bestDurationSeconds == null || set.durationSeconds > baseline.bestDurationSeconds)
    ) {
      baseline.bestDurationSeconds = set.durationSeconds;
    }
  }

  return baseline;
}
