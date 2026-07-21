/**
 * Timer for time-based exercises (plank, dead hang, …).
 *
 * Like the rest timer, elapsed time is derived from an absolute timestamp plus
 * the time already banked before the current run — never from a counter that
 * ticks once a second. A throttled or suspended interval therefore cannot make
 * the timer drift while the phone is locked or the app is in the background.
 *
 * The state is transient UI state, not training data: it lives in localStorage
 * so an accidental reload does not lose a running measurement. Only the
 * finished duration is written to IndexedDB, as part of the set.
 */

export interface ExerciseTimerState {
  /** Which set this measurement belongs to. */
  setId: string;
  /** Epoch ms when the current run started; null while paused. */
  runningSince: number | null;
  /** Milliseconds banked from previous runs. */
  accumulatedMs: number;
  /** Target for countdown mode; null counts up as a stopwatch. */
  countdownSeconds: number | null;
  /** Last write, used to discard stale state. */
  updatedAt: number;
}

const STORAGE_KEY = 'training-tracker.exercise-timer';

/** State older than this is assumed abandoned rather than resumed. */
export const MAX_TIMER_AGE_MS = 12 * 60 * 60 * 1000;

export function createTimerState(
  setId: string,
  countdownSeconds: number | null = null,
  now: number = Date.now(),
): ExerciseTimerState {
  return {
    setId,
    runningSince: null,
    accumulatedMs: 0,
    countdownSeconds,
    updatedAt: now,
  };
}

/** Total elapsed milliseconds, banked plus the run in progress. */
export function elapsedMs(state: ExerciseTimerState, now: number = Date.now()): number {
  const running = state.runningSince == null ? 0 : Math.max(0, now - state.runningSince);
  return Math.max(0, state.accumulatedMs + running);
}

export function elapsedSeconds(state: ExerciseTimerState, now: number = Date.now()): number {
  return Math.round(elapsedMs(state, now) / 1000);
}

/** Seconds left in countdown mode; null while counting up. Never negative. */
export function remainingSeconds(
  state: ExerciseTimerState,
  now: number = Date.now(),
): number | null {
  if (state.countdownSeconds == null) return null;
  return Math.max(0, state.countdownSeconds - elapsedSeconds(state, now));
}

export function isCountdownFinished(
  state: ExerciseTimerState,
  now: number = Date.now(),
): boolean {
  if (state.countdownSeconds == null) return false;
  return elapsedSeconds(state, now) >= state.countdownSeconds;
}

export function isRunning(state: ExerciseTimerState): boolean {
  return state.runningSince != null;
}

export function start(
  state: ExerciseTimerState,
  now: number = Date.now(),
): ExerciseTimerState {
  if (state.runningSince != null) return state; // already running — idempotent
  return { ...state, runningSince: now, updatedAt: now };
}

export function pause(
  state: ExerciseTimerState,
  now: number = Date.now(),
): ExerciseTimerState {
  if (state.runningSince == null) return state;
  return {
    ...state,
    // Bank the current run, then stop.
    accumulatedMs: elapsedMs(state, now),
    runningSince: null,
    updatedAt: now,
  };
}

export function reset(
  state: ExerciseTimerState,
  now: number = Date.now(),
): ExerciseTimerState {
  return { ...state, runningSince: null, accumulatedMs: 0, updatedAt: now };
}

export function setCountdown(
  state: ExerciseTimerState,
  countdownSeconds: number | null,
  now: number = Date.now(),
): ExerciseTimerState {
  return { ...state, countdownSeconds, updatedAt: now };
}

/** Shape check for whatever comes back out of localStorage. */
function isTimerState(value: unknown): value is ExerciseTimerState {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<ExerciseTimerState>;
  return (
    typeof candidate.setId === 'string' &&
    (candidate.runningSince === null || typeof candidate.runningSince === 'number') &&
    typeof candidate.accumulatedMs === 'number' &&
    candidate.accumulatedMs >= 0 &&
    (candidate.countdownSeconds === null || typeof candidate.countdownSeconds === 'number') &&
    typeof candidate.updatedAt === 'number'
  );
}

/**
 * Restores a persisted timer.
 *
 * Returns null — and clears the entry — when the state belongs to a different
 * set, is malformed, or is too old to plausibly still be running. Resuming a
 * timer from yesterday would silently record a nonsense duration.
 */
export function loadTimerState(
  setId: string,
  now: number = Date.now(),
): ExerciseTimerState | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // storage unavailable (private mode) — the timer just starts fresh
  }
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isTimerState(parsed) || parsed.setId !== setId) {
      clearTimerState();
      return null;
    }
    if (now - parsed.updatedAt > MAX_TIMER_AGE_MS) {
      clearTimerState();
      return null;
    }
    return parsed;
  } catch {
    clearTimerState();
    return null;
  }
}

export function saveTimerState(state: ExerciseTimerState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Persisting is a convenience; the timer keeps working without it.
  }
}

export function clearTimerState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
