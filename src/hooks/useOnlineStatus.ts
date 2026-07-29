import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

/**
 * Reactive connectivity flag from `navigator.onLine`. Used to keep external
 * links (Ko-fi, Tally) from presenting as tappable when they cannot open.
 * Assumes online when the API is unavailable, so nothing is hidden by mistake.
 */
export function useOnlineStatus(): boolean {
  // Server snapshot is `true`: the app is client-only, this is just a safe default.
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}
