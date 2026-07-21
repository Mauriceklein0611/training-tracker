import { useEffect } from 'react';
import type { AppSettings } from '@/types';

/**
 * Applies the colour theme to the document root.
 *
 * The preference lives in IndexedDB with the rest of the settings; a copy is
 * mirrored into localStorage purely so the very first paint after a cold start
 * already uses the right colours (an uncritical UI preference, never data).
 */
const STORAGE_KEY = 'training-tracker.theme';

export function readStoredTheme(): AppSettings['darkMode'] {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'dark' || value === 'light' || value === 'system') return value;
  } catch {
    // localStorage can be unavailable in private mode — the default is fine.
  }
  return 'dark';
}

export function applyTheme(mode: AppSettings['darkMode']): void {
  const prefersLight =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: light)').matches;

  const light = mode === 'light' || (mode === 'system' && prefersLight);
  document.documentElement.classList.toggle('light', light);
  document.documentElement.classList.toggle('dark', !light);

  const themeColor = document.querySelector('meta[name="theme-color"]');
  themeColor?.setAttribute('content', light ? '#f6f8fa' : '#0b0f14');

  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Ignore — the theme still applies for this session.
  }
}

export function useTheme(mode: AppSettings['darkMode']): void {
  useEffect(() => {
    applyTheme(mode);
    if (mode !== 'system' || typeof window.matchMedia !== 'function') return;

    const query = window.matchMedia('(prefers-color-scheme: light)');
    const listener = () => applyTheme('system');
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, [mode]);
}
