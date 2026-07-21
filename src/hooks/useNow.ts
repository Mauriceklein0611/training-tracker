import { useEffect, useState } from 'react';

/**
 * A clock that ticks while the component is mounted.
 *
 * Timers in this app are always rendered from `now` minus an absolute stored
 * timestamp, never from an accumulating counter. Browsers throttle or suspend
 * intervals in background tabs, so the extra `visibilitychange` listener
 * refreshes immediately when the user comes back — the displayed value is then
 * correct even after minutes with a locked screen.
 */
export function useNow(intervalMs = 1000, enabled = true): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!enabled) return;

    const tick = () => setNow(new Date());
    tick();

    const interval = window.setInterval(tick, intervalMs);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', tick);
    window.addEventListener('pageshow', tick);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', tick);
      window.removeEventListener('pageshow', tick);
    };
  }, [intervalMs, enabled]);

  return now;
}
