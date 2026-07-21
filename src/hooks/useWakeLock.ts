import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Keeps the display awake while a workout is running.
 *
 * Strictly a progressive enhancement. The Screen Wake Lock API is missing on
 * several browsers (notably older iOS), and even where it exists the request
 * can be rejected — for example on low battery. Every failure is swallowed:
 * the workout must never be interrupted by a message about a convenience
 * feature the user did not ask for.
 *
 * The lock is released automatically by the browser whenever the page is
 * hidden, so it is re-acquired on the way back if it is still wanted.
 */

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
};

export function isWakeLockSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return typeof (navigator as WakeLockNavigator).wakeLock?.request === 'function';
}

export interface WakeLockState {
  supported: boolean;
  /** True while a lock is actually held. */
  active: boolean;
}

export function useWakeLock(enabled: boolean): WakeLockState {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const [active, setActive] = useState(false);
  const supported = isWakeLockSupported();

  const release = useCallback(async () => {
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    setActive(false);
    if (!sentinel || sentinel.released) return;
    try {
      await sentinel.release();
    } catch {
      // Already gone — nothing to do.
    }
  }, []);

  const request = useCallback(async () => {
    if (!isWakeLockSupported()) return;
    if (sentinelRef.current && !sentinelRef.current.released) return;
    // A hidden page cannot hold a lock; the visibility handler retries later.
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

    try {
      const sentinel = await (navigator as WakeLockNavigator).wakeLock!.request('screen');
      sentinelRef.current = sentinel;
      setActive(true);
      sentinel.addEventListener('release', () => {
        if (sentinelRef.current === sentinel) sentinelRef.current = null;
        setActive(false);
      });
    } catch {
      // Denied or unsupported in this context — carry on silently.
      setActive(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      void release();
      return;
    }

    void request();

    // The browser drops the lock when the page is hidden, so take it again.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void request();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      void release();
    };
  }, [enabled, request, release]);

  return { supported, active };
}
