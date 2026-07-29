import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FALLBACK_LANGUAGE,
  LANGUAGE_PREFERENCES,
  SUPPORTED_LANGUAGES,
  applyPreference,
  isLanguagePreference,
  isSupportedLanguage,
  localeTag,
  readStoredPreference,
  resolveLanguage,
  resolvePreference,
  resources,
  setLanguage,
  t,
} from '@/i18n';

/** Overrides the read-only navigator language list for a single assertion. */
function withNavigatorLanguages<T>(languages: string[], run: () => T): T {
  const original = Object.getOwnPropertyDescriptor(window.navigator, 'languages');
  Object.defineProperty(window.navigator, 'languages', {
    configurable: true,
    value: languages,
  });
  try {
    return run();
  } finally {
    if (original) Object.defineProperty(window.navigator, 'languages', original);
  }
}

beforeEach(() => {
  localStorage.clear();
  setLanguage('de');
});

afterEach(() => {
  localStorage.clear();
  setLanguage('de');
});

describe('resolveLanguage', () => {
  it('maps regional variants to their base language', () => {
    expect(resolveLanguage(['de-DE'])).toBe('de');
    expect(resolveLanguage(['en-US'])).toBe('en');
    expect(resolveLanguage(['de-AT', 'en'])).toBe('de');
  });

  it('honours the order of preferred languages', () => {
    expect(resolveLanguage(['en-GB', 'de'])).toBe('en');
    expect(resolveLanguage(['de', 'en'])).toBe('de');
  });

  it('falls back to English for unsupported or empty input', () => {
    expect(resolveLanguage(['fr-FR', 'es'])).toBe('en');
    expect(resolveLanguage([])).toBe(FALLBACK_LANGUAGE);
    expect(FALLBACK_LANGUAGE).toBe('en');
  });
});

describe('isSupportedLanguage', () => {
  it('accepts exactly the supported languages', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      expect(isSupportedLanguage(language)).toBe(true);
    }
  });

  it('rejects regional variants and unknown tags', () => {
    // Regional mapping is `resolveLanguage`'s job, not this guard's.
    expect(isSupportedLanguage('de-DE')).toBe(false);
    expect(isSupportedLanguage('fr')).toBe(false);
    expect(isSupportedLanguage('')).toBe(false);
  });
});

describe('language preference', () => {
  it('offers automatic plus every supported language', () => {
    expect([...LANGUAGE_PREFERENCES]).toEqual(['auto', 'de', 'en']);
    expect(isLanguagePreference('auto')).toBe(true);
    expect(isLanguagePreference('de')).toBe(true);
    expect(isLanguagePreference('fr')).toBe(false);
    expect(isLanguagePreference(undefined)).toBe(false);
  });

  it('resolves automatic against the device languages', () => {
    expect(withNavigatorLanguages(['de-DE', 'en'], () => resolvePreference('auto'))).toBe(
      'de',
    );
    expect(withNavigatorLanguages(['en-US'], () => resolvePreference('auto'))).toBe('en');
    // Unsupported system language → English, never a broken UI.
    expect(withNavigatorLanguages(['fr-FR'], () => resolvePreference('auto'))).toBe('en');
  });

  it('keeps a manual choice regardless of the device language', () => {
    expect(withNavigatorLanguages(['fr-FR'], () => resolvePreference('de'))).toBe('de');
    expect(withNavigatorLanguages(['de-DE'], () => resolvePreference('en'))).toBe('en');
  });

  it('persists the preference and applies the resolved language', () => {
    expect(applyPreference('en')).toBe('en');
    expect(readStoredPreference()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(t('nav.home')).toBe('Home');

    expect(withNavigatorLanguages(['de-DE'], () => applyPreference('auto'))).toBe('de');
    // "auto" is stored as-is, so a later device change still takes effect.
    expect(readStoredPreference()).toBe('auto');
    expect(document.documentElement.lang).toBe('de');
  });

  it('defaults to automatic when nothing (or nonsense) is stored', () => {
    expect(readStoredPreference()).toBe('auto');
    localStorage.setItem('training-tracker.language', 'klingon');
    expect(readStoredPreference()).toBe('auto');
  });
});

describe('translation resources', () => {
  // Deeply collect every leaf key path so a missing/renamed key in any language
  // is caught even though the TypeScript shape already enforces the structure.
  const paths = (obj: unknown, prefix = ''): string[] =>
    typeof obj === 'object' && obj !== null
      ? Object.entries(obj).flatMap(([key, value]) =>
          paths(value, prefix ? `${prefix}.${key}` : key),
        )
      : [prefix];

  const leaf = (source: object, path: string): unknown =>
    path
      .split('.')
      .reduce<unknown>((acc, key) => (acc as Record<string, unknown>)[key], source);

  it('has identical key sets across all supported languages', () => {
    const reference = paths(resources.de).sort();
    for (const language of SUPPORTED_LANGUAGES) {
      expect(paths(resources[language]).sort()).toEqual(reference);
    }
  });

  it('has no empty translations in any language', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      for (const path of paths(resources[language])) {
        const value = leaf(resources[language], path);
        expect(typeof value, path).toBe('string');
        expect((value as string).trim().length, path).toBeGreaterThan(0);
      }
    }
  });

  it('translates navigation and shared actions in both languages', () => {
    setLanguage('de');
    expect(t('nav.plans')).toBe('Pläne');
    expect(t('action.save')).toBe('Speichern');
    setLanguage('en');
    expect(t('nav.plans')).toBe('Plans');
    expect(t('action.save')).toBe('Save');
  });

  it('uses the required DE/EN labels from #29 and #33', () => {
    setLanguage('de');
    expect(t('community:support.label')).toBe('Projekt freiwillig unterstützen');
    expect(t('community:feedback.label')).toBe('Feedback geben');
    expect(t('community:feedback.description')).toBe(
      'Fehler melden, Idee teilen oder Verbesserung vorschlagen.',
    );
    setLanguage('en');
    expect(t('community:support.label')).toBe('Support the project');
    expect(t('community:feedback.label')).toBe('Send feedback');
    expect(t('community:feedback.description')).toBe(
      'Report a bug, share an idea, or suggest an improvement.',
    );
  });

  it('renders the key itself for an unknown key instead of an empty string', () => {
    // @ts-expect-error — deliberately unknown key; typed keys catch this at build time.
    expect(t('does.not.exist')).toBe('does.not.exist');
  });
});

describe('localeTag', () => {
  it('maps the language to a BCP-47 tag for Intl formatting', () => {
    expect(localeTag('de')).toBe('de-DE');
    expect(localeTag('en')).toBe('en-US');
    setLanguage('de');
    expect(localeTag()).toBe('de-DE');
  });
});
