/**
 * Public, non-secret external links used by the Community section.
 *
 * SECURITY: these are plain public URLs — NOT credentials, tokens, webhooks or
 * API keys. The app never authenticates against Ko-fi or Tally, never calls
 * their APIs and never sends any user data to them. Tapping an entry only opens
 * the public page in a new browser tab. No secret belongs in this file, in any
 * `VITE_*` variable, or anywhere else in the client bundle (see README).
 */

import {
  FALLBACK_LANGUAGE,
  type Language,
  getLanguage,
  isSupportedLanguage,
} from '@/i18n';

/** Public Ko-fi tip page (#29). */
export const KOFI_URL = 'https://ko-fi.com/trainingtracker';

/**
 * Public Tally feedback forms (#30) — one fully localised form per language,
 * never a mixed bilingual form. Both are plain public links; the app only ever
 * opens them, it never talks to Tally's API.
 */
export const TALLY_FEEDBACK_URLS: Readonly<Record<Language, string>> = {
  de: 'https://tally.so/r/q4Xvp2',
  en: 'https://tally.so/r/pbXv9V',
};

/** Tally's public terms & privacy overview, linked from the privacy notice. */
export const TALLY_PRIVACY_URL = 'https://tally.so/help/terms-and-privacy';

/**
 * A link is only offered when it is a well-formed public `https` URL. Anything
 * else (empty, non-https, malformed) is treated as "not configured".
 */
export function isConfiguredExternalUrl(url: string): boolean {
  if (!url) return false;
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * The feedback form URL for a language. Unsupported tags fall back to the
 * English form (the #31 fallback rule), so an added-but-untranslated language
 * can never produce a missing link. The bare URL is returned verbatim: no query
 * parameters carrying app, device, workout or user data are ever appended.
 */
export function tallyFeedbackUrl(language: string = getLanguage()): string {
  const key = isSupportedLanguage(language) ? language : FALLBACK_LANGUAGE;
  return TALLY_FEEDBACK_URLS[key];
}
