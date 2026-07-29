/**
 * When the discreet support hint on the home screen may appear (#32).
 *
 * Deliberately conservative and pure, so the rules are testable and can never
 * turn into a nagging banner: proven usage first, a long cooldown, an explicit
 * permanent opt-out, and never in the middle of — or right after — training.
 */

/** Minimum number of finished workouts before the hint is ever considered. */
export const SUPPORT_HINT_MIN_SESSIONS = 5;

/** Minimum distance between two appearances. */
export const SUPPORT_HINT_COOLDOWN_DAYS = 30;

export interface SupportHintState {
  /** Finished workouts on this device. */
  finishedSessions: number;
  /** Local calendar day of the most recent finished workout, if any. */
  lastFinishedDayKey?: string;
  /** A workout is currently running. */
  hasRunningWorkout: boolean;
  /** When the hint was last shown (ISO), from the local settings. */
  lastShownAt?: string;
  /** The user chose "never again". */
  dismissed?: boolean;
  /** Today as a local calendar day key. */
  todayDayKey: string;
  now: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function shouldShowSupportHint(state: SupportHintState): boolean {
  // A permanent opt-out is final — no exceptions, no re-asking.
  if (state.dismissed) return false;

  // Proven usage only: no support ask before the app has actually been used.
  if (state.finishedSessions < SUPPORT_HINT_MIN_SESSIONS) return false;

  // Never while training: the live view must stay free of anything unrelated.
  if (state.hasRunningWorkout) return false;

  // Never as an immediate reaction to finishing a workout, hitting a record or
  // reading a result — a workout finished today suppresses the hint entirely.
  if (state.lastFinishedDayKey && state.lastFinishedDayKey === state.todayDayKey) {
    return false;
  }

  if (state.lastShownAt) {
    const shown = new Date(state.lastShownAt).getTime();
    // An unparsable timestamp is treated as "just shown" rather than as a
    // licence to ask again.
    if (!Number.isFinite(shown)) return false;
    if (state.now.getTime() - shown < SUPPORT_HINT_COOLDOWN_DAYS * DAY_MS) return false;
  }

  return true;
}
