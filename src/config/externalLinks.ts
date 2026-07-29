/**
 * Public, non-secret external links used by the Community section.
 *
 * SECURITY: these are plain public URLs — NOT credentials, tokens, webhooks or
 * API keys. The app never authenticates against Ko-fi or Tally, never calls
 * their APIs and never sends any user data to them. Tapping an entry only opens
 * the public page in a new browser tab. No secret belongs in this file, in any
 * `VITE_*` variable, or anywhere else in the client bundle (see README).
 */

/** Public Ko-fi tip page (#29). */
export const KOFI_URL = 'https://ko-fi.com/trainingtracker';

/**
 * Public Tally feedback form (#30). Empty until the form is created and its
 * public link is pasted here (see README → Community & Support). While empty,
 * the feedback/bug entries are simply not rendered — the app never ships a dead
 * or misleading link.
 */
export const TALLY_FEEDBACK_URL = '';

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
