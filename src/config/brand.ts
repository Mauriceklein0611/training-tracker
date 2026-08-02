export const PRODUCT_NAME = 'Exerivo';
export const APP_VERSION = '1.0.0';

export const DEFAULT_SITE_URL = 'https://exerivo.com/';
export const DEFAULT_APP_URL = 'https://app.exerivo.com/';
export const LEGACY_APP_URL = 'https://training-tracker-4xu.pages.dev/';

function normalizedPublicUrl(value: string | undefined, fallback: string): string {
  const candidate = value?.trim();
  if (!candidate) return fallback;

  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

/** Public product website. Never contains credentials or user data. */
export const SITE_URL = normalizedPublicUrl(
  import.meta.env.VITE_SITE_URL,
  DEFAULT_SITE_URL,
);
export const IMPRINT_URL = new URL('impressum', SITE_URL).toString();

/** Canonical PWA origin. Never contains credentials or user data. */
export const APP_URL = normalizedPublicUrl(import.meta.env.VITE_APP_URL, DEFAULT_APP_URL);

export type AppOrigin = 'canonical' | 'legacy' | 'other';

/**
 * Distinguishes the temporary pages.dev migration origin from the canonical
 * app origin. Local data remains origin-bound; this helper never reads it.
 */
export function appOrigin(hostname?: string): AppOrigin {
  const current =
    hostname ?? (typeof window === 'undefined' ? '' : window.location.hostname);
  if (current === new URL(APP_URL).hostname) return 'canonical';
  if (current === new URL(LEGACY_APP_URL).hostname) return 'legacy';
  return 'other';
}
