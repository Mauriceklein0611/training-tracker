import { clearTimerState } from '@/services/exerciseTimer';

/**
 * Transient app state kept outside the database in localStorage — the running
 * exercise timer and the mirrored theme. This is deliberately separate from the
 * training data in IndexedDB, and is cleared through this one place so a reset
 * never resorts to a blanket `localStorage.clear()` that could wipe unrelated
 * keys from other apps on the same origin.
 */

const TRANSIENT_PREFIX = 'training-tracker.';

export function clearTransientAppState(scope: 'timers' | 'all'): void {
  if (scope === 'timers') {
    // Deleting the training history must also drop a running exercise timer.
    clearTimerState();
    return;
  }

  // Full reset: remove every known training-tracker.* key (timer, theme, …).
  try {
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && key.startsWith(TRANSIENT_PREFIX)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // localStorage can be unavailable (private mode); the DB reset is what matters.
  }
}
