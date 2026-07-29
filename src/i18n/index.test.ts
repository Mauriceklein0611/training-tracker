import { describe, expect, it } from 'vitest';
import {
  FALLBACK_LANGUAGE,
  SUPPORTED_LANGUAGES,
  communityStrings,
  isSupportedLanguage,
  resolveLanguage,
  resources,
} from '@/i18n';

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

describe('community resources parity', () => {
  // Deeply collect every leaf key path so a missing/renamed key in any language
  // is caught even though the TypeScript shape already enforces the structure.
  const paths = (obj: unknown, prefix = ''): string[] =>
    typeof obj === 'object' && obj !== null
      ? Object.entries(obj).flatMap(([key, value]) =>
          paths(value, prefix ? `${prefix}.${key}` : key),
        )
      : [prefix];

  it('has identical key sets across all supported languages', () => {
    const reference = paths(resources.de).sort();
    for (const language of SUPPORTED_LANGUAGES) {
      expect(paths(resources[language]).sort()).toEqual(reference);
    }
  });

  it('has no empty translations in any language', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const strings = communityStrings(language);
      const leaves = paths(strings).map((path) =>
        path.split('.').reduce<unknown>((acc, key) => (acc as never)[key], strings),
      );
      for (const leaf of leaves) {
        expect(typeof leaf).toBe('string');
        expect((leaf as string).trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('uses the required DE/EN labels from #29 and #30', () => {
    expect(communityStrings('de').support.label).toBe('Projekt freiwillig unterstützen');
    expect(communityStrings('en').support.label).toBe('Support the project');
    expect(communityStrings('de').feedback.label).toBe('Feedback & Wünsche');
    expect(communityStrings('en').feedback.label).toBe('Feedback & requests');
    expect(communityStrings('de').bug.label).toBe('Fehler melden');
    expect(communityStrings('en').bug.label).toBe('Report a bug');
  });
});
