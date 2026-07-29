/**
 * Lightweight, offline-first i18n for the Community section (#29 Ko-fi, #30
 * Tally). All strings are bundled locally — no translation CDN, no runtime
 * request. Deliberately small: the full app-wide i18next migration is #31, and
 * this module is shaped so it can be folded into it later (stable `Language`
 * type, `resolveLanguage`, namespaced resources) without reworking callers.
 *
 * Only presentation is localised; no stored data, enum value or format contract
 * is ever translated.
 */

export type Language = 'de' | 'en';

export const SUPPORTED_LANGUAGES = ['de', 'en'] as const satisfies readonly Language[];

/** Unsupported system languages fall back to English (issue #31 rule). */
export const FALLBACK_LANGUAGE: Language = 'en';

interface CommunityStrings {
  sectionTitle: string;
  externalHint: string;
  offlineHint: string;
  freeNote: string;
  /** Appended to each link's accessible name so its external nature is spoken. */
  opensExternalA11y: string;
  support: { label: string; description: string };
  feedback: { label: string; description: string };
  bug: { label: string; description: string };
  privacyTitle: string;
  privacyText: string;
}

interface Resources {
  community: CommunityStrings;
}

// `Record<Language, Resources>` gives compile-time key parity: a missing or
// misshaped translation in any language fails the typecheck.
export const resources: Record<Language, Resources> = {
  de: {
    community: {
      sectionTitle: 'Community',
      externalHint:
        'Diese Einträge öffnen einen externen Dienst in einem neuen Tab. Es werden keine Trainings-, Körper- oder Gerätedaten übertragen.',
      offlineHint:
        'Offline nicht verfügbar — dafür ist eine Internetverbindung nötig. Die App selbst funktioniert offline uneingeschränkt weiter.',
      freeNote:
        'Die App bleibt dauerhaft kostenlos. Unterstützung ist freiwillig und keine steuerlich absetzbare Spende.',
      opensExternalA11y: 'externer Link, öffnet in neuem Tab',
      support: {
        label: 'Projekt freiwillig unterstützen',
        description:
          'Bleibt komplett kostenlos — freiwillige Unterstützung über Ko-fi, ohne Konto in der App.',
      },
      feedback: {
        label: 'Feedback & Wünsche',
        description: 'Ideen und Feature-Wünsche über ein externes Formular teilen.',
      },
      bug: {
        label: 'Fehler melden',
        description:
          'Ein Problem melden — öffnet dasselbe externe Formular mit Kategorieauswahl.',
      },
      privacyTitle: 'Community-Links: Ko-fi und Feedback-Formular',
      privacyText:
        'Die Einträge im Community-Bereich öffnen externe Dienste in einem neuen Tab (Ko-fi für freiwillige Unterstützung, Tally für Feedback). Dabei verlässt du die App; der jeweilige Anbieter verarbeitet deine Eingaben nach seinen eigenen Bedingungen. Es werden keine Trainings-, Körper- oder Gerätedaten automatisch übertragen und keine Parameter mit App-Daten angehängt. Zahlungen über Ko-fi sind freiwillige Unterstützung und keine steuerlich absetzbare Spende.',
    },
  },
  en: {
    community: {
      sectionTitle: 'Community',
      externalHint:
        'These entries open an external service in a new tab. No training, body or device data is transferred.',
      offlineHint:
        'Unavailable offline — this needs an internet connection. The app itself keeps working fully offline.',
      freeNote:
        'The app stays free forever. Support is voluntary and not a tax-deductible donation.',
      opensExternalA11y: 'external link, opens in a new tab',
      support: {
        label: 'Support the project',
        description:
          'Stays completely free — voluntary support via Ko-fi, with no in-app account.',
      },
      feedback: {
        label: 'Feedback & requests',
        description: 'Share ideas and feature requests through an external form.',
      },
      bug: {
        label: 'Report a bug',
        description:
          'Report a problem — opens the same external form with a category picker.',
      },
      privacyTitle: 'Community links: Ko-fi and feedback form',
      privacyText:
        'The entries in the Community section open external services in a new tab (Ko-fi for voluntary support, Tally for feedback). You leave the app; the respective provider processes your input under its own terms. No training, body or device data is transferred automatically and no parameters carrying app data are appended. Payments via Ko-fi are voluntary support and not a tax-deductible donation.',
    },
  },
};

/**
 * Picks the best supported language for an ordered list of BCP-47 tags
 * (`navigator.languages`). Regional variants map to their base (`de-DE` → `de`,
 * `en-US` → `en`); anything unsupported yields the English fallback.
 */
export function resolveLanguage(tags: readonly string[]): Language {
  for (const tag of tags) {
    const base = tag.toLowerCase().split('-')[0];
    if (base === 'de') return 'de';
    if (base === 'en') return 'en';
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

// Resolved once per load. Manual switching (Auto/DE/EN) and reactive re-render
// on change are part of #31; until then the language is stable per session.
let currentLanguage: Language | null = null;

export function getLanguage(): Language {
  return (currentLanguage ??= detectLanguage());
}

/** Sets the active language and mirrors it onto `<html lang>`. */
export function setLanguage(language: Language): void {
  currentLanguage = language;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language;
  }
}

/** Called at startup so the document language matches what is rendered. */
export function applyDocumentLanguage(): void {
  setLanguage(getLanguage());
}

export function communityStrings(language: Language = getLanguage()): CommunityStrings {
  return resources[language].community;
}
