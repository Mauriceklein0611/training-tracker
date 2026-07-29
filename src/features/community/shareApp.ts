/**
 * Sharing the app itself (#32) — an equal alternative to financial support.
 *
 * PRIVACY: the payload is a fixed localised title/text plus the app's own
 * origin. No workout, body, device or usage data is ever shared, and no
 * third-party SDK is involved: this is the browser's own Web Share API with a
 * clipboard fallback.
 */

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'unavailable';

/** The public app URL: the origin this PWA is served from, without any path. */
export function appShareUrl(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

export async function shareApp(payload: {
  title: string;
  text: string;
}): Promise<ShareResult> {
  const url = appShareUrl();
  if (!url) return 'unavailable';

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: payload.title, text: payload.text, url });
      return 'shared';
    } catch (error) {
      // The user closing the sheet is not an error worth reporting.
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
      // Any other failure falls through to the clipboard.
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return 'copied';
    } catch {
      // Clipboard can be blocked without a user gesture or in an insecure context.
    }
  }

  return 'unavailable';
}
