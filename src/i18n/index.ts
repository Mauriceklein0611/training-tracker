/**
 * App-wide i18n (#31): i18next with locally bundled resources, no CDN and no
 * runtime request, so both languages are fully available offline.
 *
 * Language resolution has two layers:
 *  - the stored *preference* (`auto` | `de` | `en`) lives with the other UI
 *    settings in IndexedDB and is mirrored into localStorage so the very first
 *    paint after a cold start is already in the right language;
 *  - the *active* language is the resolved result — with `auto` it follows the
 *    device languages and falls back to English for anything unsupported.
 *
 * Only presentation is localised. No stored value, enum, format contract or
 * user content is ever translated (see docs/FORMAT_COMPATIBILITY.md).
 */
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  FALLBACK_LANGUAGE,
  SUPPORTED_LANGUAGES,
  type Language,
  defaultNS,
  resources,
} from '@/i18n/resources';

export {
  FALLBACK_LANGUAGE,
  SUPPORTED_LANGUAGES,
  resources,
  type Language,
  type Namespace,
} from '@/i18n/resources';

/** What the user picked; `auto` means "follow the device". */
export type LanguagePreference = 'auto' | Language;

export const LANGUAGE_PREFERENCES = [
  'auto',
  ...SUPPORTED_LANGUAGES,
] as const satisfies readonly LanguagePreference[];

/**
 * Mirror of the preference for the pre-React first paint. The authoritative
 * copy stays in IndexedDB with the other settings; this is an uncritical UI
 * preference, never data (same approach as the theme).
 */
const STORAGE_KEY = 'training-tracker.language';

/** Narrows an arbitrary tag to a supported language (exact match, no region). */
export function isSupportedLanguage(tag: string): tag is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(tag);
}

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return (
    typeof value === 'string' &&
    (LANGUAGE_PREFERENCES as readonly string[]).includes(value)
  );
}

/**
 * Picks the best supported language for an ordered list of BCP-47 tags
 * (`navigator.languages`). Regional variants map to their base (`de-DE` → `de`,
 * `en-US` → `en`); anything unsupported yields the English fallback.
 */
export function resolveLanguage(tags: readonly string[]): Language {
  for (const tag of tags) {
    const base = tag.toLowerCase().split('-')[0];
    if (isSupportedLanguage(base)) return base;
  }
  return FALLBACK_LANGUAGE;
}

/** Reads the browser's preferred languages, honouring order. */
export function detectLanguage(): Language {
  if (typeof navigator === 'undefined') return FALLBACK_LANGUAGE;
  const tags =
    navigator.languages && navigator.languages.length > 0
      ? navigator.languages
      : navigator.language
        ? [navigator.language]
        : [];
  return resolveLanguage(tags);
}

/** Resolves a stored preference into the language actually rendered. */
export function resolvePreference(preference: LanguagePreference): Language {
  return preference === 'auto' ? detectLanguage() : preference;
}

export function readStoredPreference(): LanguagePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (isLanguagePreference(value)) return value;
  } catch {
    // localStorage can be unavailable in private mode — `auto` is fine.
  }
  return 'auto';
}

function storePreference(preference: LanguagePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Ignore — the language still applies for this session.
  }
}

// Initialised synchronously with bundled resources: `t()` is usable from the
// first import, which also keeps tests free of async i18n setup.
void i18next.use(initReactI18next).init({
  resources,
  lng: resolvePreference(readStoredPreference()),
  fallbackLng: FALLBACK_LANGUAGE,
  defaultNS,
  ns: Object.keys(resources.de),
  // A missing key is a bug, not a runtime feature: render the key itself so it
  // is obvious in review and in tests instead of showing an empty string.
  parseMissingKeyHandler: (key) => key,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export const i18n = i18next;

/** The language actually rendered right now. */
export function getLanguage(): Language {
  const current = i18next.resolvedLanguage ?? i18next.language;
  return isSupportedLanguage(current) ? current : FALLBACK_LANGUAGE;
}

/** BCP-47 tag for `Intl` / `toLocaleString`. */
export function localeTag(language: Language = getLanguage()): 'de-DE' | 'en-US' {
  return language === 'de' ? 'de-DE' : 'en-US';
}

/**
 * Applies a language and mirrors it onto `<html lang>` so screen readers and
 * hyphenation use the right language. Persists nothing.
 */
export function applyLanguage(language: Language): void {
  if (getLanguage() !== language) void i18next.changeLanguage(language);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language;
  }
}

/** Applies a preference (resolving `auto`) and mirrors it to localStorage. */
export function applyPreference(preference: LanguagePreference): Language {
  const language = resolvePreference(preference);
  storePreference(preference);
  applyLanguage(language);
  return language;
}

/** Imperative switch of the rendered language (used by tests and tooling). */
export function setLanguage(language: Language): void {
  applyLanguage(language);
}

/** Called before the first paint so `<html lang>` matches what is rendered. */
export function applyDocumentLanguage(): void {
  applyLanguage(resolvePreference(readStoredPreference()));
}

/** Direct access for non-React code (services, formatters, validation). */
export const t = i18next.t.bind(i18next);
