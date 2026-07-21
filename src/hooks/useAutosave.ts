import { useCallback, useEffect, useRef } from 'react';

export interface AutosaveHandle {
  /** Writes immediately if there are unsaved changes. */
  flush: () => void;
  /** Drops a pending write without saving it. */
  cancel: () => void;
  /**
   * Drops a pending write and blocks every future one, including the flush on
   * unmount. Needed because the `enabled` prop is only read at render time: a
   * component that finishes its work inside an event handler and is unmounted
   * before the next render would otherwise still flush a stale draft.
   */
  disable: () => void;
  /** Treats the current value as saved, without writing it. */
  markSaved: () => void;
}

/**
 * Debounced autosave for a form draft.
 *
 * Typing in the live view must not hit IndexedDB on every keystroke, but a set
 * that is half entered when the app is closed must not be lost either. So the
 * value is written a short moment after typing stops, and flushed immediately
 * whenever the app is about to go away:
 *
 * - `visibilitychange` to hidden — switching apps, locking the phone
 * - `pagehide` — the only event iOS Safari reliably fires before unloading
 * - unmount — moving to the next set or leaving the screen
 *
 * Nothing is written while the value is unchanged: the last saved state is
 * compared via a serialised snapshot.
 *
 * `enabled: false` cancels any pending write and stops further ones. The live
 * view uses that once a set has been completed, so a stale draft can never
 * overwrite a finished set.
 */
export function useAutosave<T>(
  value: T,
  save: (value: T) => void,
  options: { delayMs?: number; enabled?: boolean; serialize?: (value: T) => string } = {},
): AutosaveHandle {
  const { delayMs = 400, enabled = true, serialize = JSON.stringify } = options;

  const timeoutRef = useRef<number | null>(null);
  const disabledRef = useRef(false);
  // Refs, so the event listeners below never need re-registering.
  const valueRef = useRef(value);
  const saveRef = useRef(save);
  const enabledRef = useRef(enabled);
  const serializeRef = useRef(serialize);
  const lastSavedRef = useRef<string>(serialize(value));

  valueRef.current = value;
  saveRef.current = save;
  enabledRef.current = enabled;
  serializeRef.current = serialize;

  const clearPending = useCallback(() => {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const flush = useCallback(() => {
    clearPending();
    if (!enabledRef.current || disabledRef.current) return;

    const snapshot = serializeRef.current(valueRef.current);
    if (snapshot === lastSavedRef.current) return; // nothing changed
    lastSavedRef.current = snapshot;
    saveRef.current(valueRef.current);
  }, [clearPending]);

  const cancel = useCallback(() => {
    clearPending();
  }, [clearPending]);

  const disable = useCallback(() => {
    disabledRef.current = true;
    clearPending();
  }, [clearPending]);

  const markSaved = useCallback(() => {
    clearPending();
    lastSavedRef.current = serializeRef.current(valueRef.current);
  }, [clearPending]);

  // Schedule a write whenever the value actually changes.
  const snapshot = serialize(value);
  useEffect(() => {
    if (!enabled || disabledRef.current) {
      clearPending();
      return;
    }
    if (snapshot === lastSavedRef.current) return;

    clearPending();
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      flush();
    }, delayMs);

    return clearPending;
  }, [snapshot, enabled, delayMs, flush, clearPending]);

  // Flush before the app can disappear.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    const onPageHide = () => flush();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      // Unmount: the user moved on, so persist whatever is still pending.
      flush();
    };
  }, [flush]);

  return { flush, cancel, disable, markSaved };
}
