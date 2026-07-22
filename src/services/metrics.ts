import type {
  SessionExercise,
  SetType,
  SetWithContext,
  TrackingType,
  WeightMode,
  WorkoutSet,
} from '@/types';

/**
 * Domain calculations.
 *
 * Everything here is a pure function so the rules can be unit tested and are
 * never duplicated inside a component.
 *
 * Guiding principle: never invent a number. If a metric is not meaningful for
 * an exercise (kilogram volume for a TRX row, for example) the function returns
 * `null` and the UI shows "–" instead of a made-up value.
 */

/** Sets that count towards working volume. Warm-ups are excluded by default. */
export const WORKING_SET_TYPES: SetType[] = ['working', 'drop', 'failure'];

export function isWorkingSet(set: WorkoutSet): boolean {
  return WORKING_SET_TYPES.includes(set.setType);
}

export function isCompleted(set: WorkoutSet): boolean {
  return Boolean(set.completedAt);
}

/**
 * Total load a set actually moved, in kilograms.
 *
 * - `per_hand`: the entered number is one side, so it is multiplied by
 *   `weightMultiplier` (two 20 kg dumbbells → 40 kg).
 * - `total`: the number already is the whole load.
 * - `added_weight` / `assistance` / `none`: there is no honest total load,
 *   because bodyweight is not part of the record → `null`.
 */
export function effectiveLoadKg(
  set: Pick<WorkoutSet, 'weightKg'>,
  context: Pick<SessionExercise, 'weightModeSnapshot' | 'weightMultiplierSnapshot'>,
): number | null {
  if (set.weightKg == null) return null;
  switch (context.weightModeSnapshot) {
    case 'per_hand':
      return set.weightKg * (context.weightMultiplierSnapshot || 1);
    case 'total':
      return set.weightKg;
    case 'added_weight':
    case 'assistance':
    case 'none':
      return null;
  }
}

/**
 * Kilogram volume of a single set (load × repetitions).
 *
 * Only produced for genuinely weighted exercises. Bodyweight, assisted and
 * time-based work returns `null` — see `addedWeightVolumeKg` for the extra
 * weight carried during bodyweight sets.
 */
export function setVolumeKg(
  set: WorkoutSet,
  context: Pick<
    SessionExercise,
    'trackingTypeSnapshot' | 'weightModeSnapshot' | 'weightMultiplierSnapshot'
  >,
): number | null {
  if (context.trackingTypeSnapshot !== 'weight_reps') return null;
  if (set.reps == null || set.reps <= 0) return null;
  const load = effectiveLoadKg(set, context);
  if (load == null || load <= 0) return null;
  return load * set.reps;
}

/**
 * Volume of the *additional* weight carried in a bodyweight set.
 * Reported separately so it is never confused with barbell volume.
 */
export function addedWeightVolumeKg(
  set: WorkoutSet,
  context: Pick<SessionExercise, 'trackingTypeSnapshot' | 'weightModeSnapshot'>,
): number | null {
  if (context.trackingTypeSnapshot !== 'bodyweight_reps') return null;
  if (context.weightModeSnapshot !== 'added_weight') return null;
  if (!set.weightKg || set.weightKg <= 0 || !set.reps || set.reps <= 0) return null;
  return set.weightKg * set.reps;
}

/** Repetition window in which an Epley estimate stays reasonably reliable. */
export const ONE_RM_MIN_REPS = 1;
export const ONE_RM_MAX_REPS = 12;

/**
 * Estimated one-repetition maximum using the Epley formula:
 *
 *   1RM ≈ load × (1 + reps / 30)
 *
 * This is an *estimate*, not a measurement, and the UI always labels it as
 * such. It is only computed for weighted exercises inside a 1–12 rep window;
 * outside that range the formula degrades badly.
 */
export function estimatedOneRepMax(
  set: WorkoutSet,
  context: Pick<
    SessionExercise,
    'trackingTypeSnapshot' | 'weightModeSnapshot' | 'weightMultiplierSnapshot'
  >,
): number | null {
  if (context.trackingTypeSnapshot !== 'weight_reps') return null;
  if (set.reps == null || set.reps < ONE_RM_MIN_REPS || set.reps > ONE_RM_MAX_REPS)
    return null;
  const load = effectiveLoadKg(set, context);
  if (load == null || load <= 0) return null;
  if (set.reps === 1) return load;
  return load * (1 + set.reps / 30);
}

/** Which numeric fields a tracking type expects the user to fill in. */
export function requiredFieldsFor(trackingType: TrackingType): {
  weight: boolean;
  reps: boolean;
  duration: boolean;
} {
  switch (trackingType) {
    case 'weight_reps':
      return { weight: true, reps: true, duration: false };
    case 'bodyweight_reps':
    case 'assisted_bodyweight_reps':
      // Added weight / assistance is optional: a clean bodyweight set is valid.
      return { weight: false, reps: true, duration: false };
    case 'reps_only':
      return { weight: false, reps: true, duration: false };
    case 'duration':
      return { weight: false, reps: false, duration: true };
  }
}

/** Whether a weight input should be shown at all, and what to call it. */
export function weightFieldLabel(
  trackingType: TrackingType,
  weightMode: WeightMode,
): string | null {
  if (trackingType === 'duration' || trackingType === 'reps_only') return null;
  switch (weightMode) {
    case 'per_hand':
      return 'Gewicht je Hand (kg)';
    case 'total':
      return 'Gewicht gesamt (kg)';
    case 'added_weight':
      return 'Zusatzgewicht (kg)';
    case 'assistance':
      return 'Unterstützung (kg)';
    case 'none':
      return null;
  }
}

export interface VolumeTotals {
  /** Sum of honest kilogram volume (weighted exercises only). */
  volumeKg: number;
  /** Sum of the extra weight moved during bodyweight sets. */
  addedWeightVolumeKg: number;
  /** Repetitions across all counted sets, regardless of tracking type. */
  totalReps: number;
  /** Seconds accumulated by time-based sets. */
  totalDurationSeconds: number;
  /** Number of sets that contributed. */
  setCount: number;
  /** Sets that carried no computable kilogram volume. */
  setsWithoutVolume: number;
}

export function emptyVolumeTotals(): VolumeTotals {
  return {
    volumeKg: 0,
    addedWeightVolumeKg: 0,
    totalReps: 0,
    totalDurationSeconds: 0,
    setCount: 0,
    setsWithoutVolume: 0,
  };
}

/**
 * Aggregates a list of sets.
 * By default only completed working sets are counted.
 */
export function aggregateVolume(
  entries: { set: WorkoutSet; sessionExercise: SessionExercise }[],
  options: { includeWarmup?: boolean; requireCompleted?: boolean } = {},
): VolumeTotals {
  const { includeWarmup = false, requireCompleted = true } = options;
  const totals = emptyVolumeTotals();

  for (const { set, sessionExercise } of entries) {
    if (requireCompleted && !isCompleted(set)) continue;
    if (!includeWarmup && !isWorkingSet(set)) continue;

    totals.setCount += 1;
    const volume = setVolumeKg(set, sessionExercise);
    if (volume == null) {
      totals.setsWithoutVolume += 1;
    } else {
      totals.volumeKg += volume;
    }
    totals.addedWeightVolumeKg += addedWeightVolumeKg(set, sessionExercise) ?? 0;
    totals.totalReps += set.reps ?? 0;
    totals.totalDurationSeconds += set.durationSeconds ?? 0;
  }
  return totals;
}

export interface PersonalRecords {
  exerciseId: string;
  exerciseName: string;
  trackingType: TrackingType;
  /** Heaviest total load moved in a working set. */
  bestLoadKg: number | null;
  bestLoadReps: number | null;
  bestLoadAt: string | null;
  /** Highest Epley estimate. */
  bestEstimatedOneRepMax: number | null;
  bestEstimatedOneRepMaxAt: string | null;
  /** Most repetitions in a single working set. */
  bestReps: number | null;
  bestRepsAt: string | null;
  /** Longest single time-based set. */
  bestDurationSeconds: number | null;
  bestDurationAt: string | null;
  /** Highest kilogram volume within one session. */
  bestSessionVolumeKg: number | null;
  bestSessionVolumeAt: string | null;
}

function emptyRecords(
  exerciseId: string,
  exerciseName: string,
  trackingType: TrackingType,
): PersonalRecords {
  return {
    exerciseId,
    exerciseName,
    trackingType,
    bestLoadKg: null,
    bestLoadReps: null,
    bestLoadAt: null,
    bestEstimatedOneRepMax: null,
    bestEstimatedOneRepMaxAt: null,
    bestReps: null,
    bestRepsAt: null,
    bestDurationSeconds: null,
    bestDurationAt: null,
    bestSessionVolumeKg: null,
    bestSessionVolumeAt: null,
  };
}

/**
 * Personal bests per exercise, derived from completed working sets.
 * Grouping uses `exerciseId` so a renamed exercise keeps one record line.
 */
export function computePersonalRecords(
  entries: SetWithContext[],
  options: { includeWarmup?: boolean } = {},
): Map<string, PersonalRecords> {
  const { includeWarmup = false } = options;
  const records = new Map<string, PersonalRecords>();
  const sessionVolume = new Map<string, Map<string, number>>();

  for (const { set, sessionExercise, session } of entries) {
    if (!isCompleted(set)) continue;
    if (!includeWarmup && !isWorkingSet(set)) continue;

    const key = sessionExercise.exerciseId;
    const record =
      records.get(key) ??
      emptyRecords(
        key,
        sessionExercise.exerciseNameSnapshot,
        sessionExercise.trackingTypeSnapshot,
      );
    // Keep the most recent name for display.
    record.exerciseName = sessionExercise.exerciseNameSnapshot;
    const at = set.completedAt ?? session.startedAt;

    const load = effectiveLoadKg(set, sessionExercise);
    if (load != null && (record.bestLoadKg == null || load > record.bestLoadKg)) {
      record.bestLoadKg = load;
      record.bestLoadReps = set.reps ?? null;
      record.bestLoadAt = at;
    }

    const oneRm = estimatedOneRepMax(set, sessionExercise);
    if (
      oneRm != null &&
      (record.bestEstimatedOneRepMax == null || oneRm > record.bestEstimatedOneRepMax)
    ) {
      record.bestEstimatedOneRepMax = oneRm;
      record.bestEstimatedOneRepMaxAt = at;
    }

    if (set.reps != null && (record.bestReps == null || set.reps > record.bestReps)) {
      record.bestReps = set.reps;
      record.bestRepsAt = at;
    }

    if (
      set.durationSeconds != null &&
      (record.bestDurationSeconds == null ||
        set.durationSeconds > record.bestDurationSeconds)
    ) {
      record.bestDurationSeconds = set.durationSeconds;
      record.bestDurationAt = at;
    }

    const volume = setVolumeKg(set, sessionExercise);
    if (volume != null) {
      const perSession = sessionVolume.get(key) ?? new Map<string, number>();
      perSession.set(session.id, (perSession.get(session.id) ?? 0) + volume);
      sessionVolume.set(key, perSession);
    }

    records.set(key, record);
  }

  // Second pass: session volume records need the completed per-session sums.
  for (const [exerciseId, perSession] of sessionVolume) {
    const record = records.get(exerciseId);
    if (!record) continue;
    for (const [sessionId, volume] of perSession) {
      if (record.bestSessionVolumeKg == null || volume > record.bestSessionVolumeKg) {
        record.bestSessionVolumeKg = volume;
        const entry = entries.find((candidate) => candidate.session.id === sessionId);
        record.bestSessionVolumeAt = entry?.session.startedAt ?? null;
      }
    }
  }

  return records;
}

export interface NewRecord {
  exerciseId: string;
  exerciseName: string;
  kind: 'load' | 'oneRepMax' | 'reps' | 'duration' | 'sessionVolume';
  label: string;
  value: number;
  previousValue: number | null;
}

const RECORD_LABELS: Record<NewRecord['kind'], string> = {
  load: 'Neues Bestgewicht',
  oneRepMax: 'Neues geschätztes 1RM',
  reps: 'Neue Bestwiederholungen',
  duration: 'Neue Bestzeit',
  sessionVolume: 'Neues Bestvolumen (Einheit)',
};

/**
 * Records set during `sessionEntries` that beat everything achieved before.
 * Used for the "new personal best" list on the workout summary screen.
 */
export function findNewRecords(
  sessionEntries: SetWithContext[],
  historyEntries: SetWithContext[],
): NewRecord[] {
  const before = computePersonalRecords(historyEntries);
  const during = computePersonalRecords(sessionEntries);
  const results: NewRecord[] = [];

  const compare = (
    current: PersonalRecords,
    kind: NewRecord['kind'],
    currentValue: number | null,
    previousValue: number | null,
  ) => {
    if (currentValue == null) return;
    if (previousValue != null && currentValue <= previousValue) return;
    results.push({
      exerciseId: current.exerciseId,
      exerciseName: current.exerciseName,
      kind,
      label: RECORD_LABELS[kind],
      value: currentValue,
      previousValue,
    });
  };

  for (const [exerciseId, current] of during) {
    const previous = before.get(exerciseId);
    compare(current, 'load', current.bestLoadKg, previous?.bestLoadKg ?? null);
    compare(
      current,
      'oneRepMax',
      current.bestEstimatedOneRepMax,
      previous?.bestEstimatedOneRepMax ?? null,
    );
    compare(current, 'reps', current.bestReps, previous?.bestReps ?? null);
    compare(
      current,
      'duration',
      current.bestDurationSeconds,
      previous?.bestDurationSeconds ?? null,
    );
    compare(
      current,
      'sessionVolume',
      current.bestSessionVolumeKg,
      previous?.bestSessionVolumeKg ?? null,
    );
  }

  return results;
}
