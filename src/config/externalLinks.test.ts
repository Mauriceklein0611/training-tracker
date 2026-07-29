import { afterEach, describe, expect, it } from 'vitest';
import { SUPPORTED_LANGUAGES, setLanguage } from '@/i18n';
import {
  KOFI_URL,
  TALLY_FEEDBACK_URLS,
  TALLY_PRIVACY_URL,
  isConfiguredExternalUrl,
  tallyFeedbackUrl,
} from '@/config/externalLinks';

afterEach(() => {
  setLanguage('de');
});

describe('external links config', () => {
  it('ships the public Ko-fi URL and no credentials', () => {
    expect(KOFI_URL).toBe('https://ko-fi.com/trainingtracker');
    expect(isConfiguredExternalUrl(KOFI_URL)).toBe(true);
    // No query/secret material appended to the public link.
    expect(KOFI_URL).not.toMatch(/[?&](token|key|secret|api)/i);
  });

  it('only accepts well-formed https URLs', () => {
    expect(isConfiguredExternalUrl('')).toBe(false);
    expect(isConfiguredExternalUrl('http://ko-fi.com/x')).toBe(false);
    expect(isConfiguredExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isConfiguredExternalUrl('not a url')).toBe(false);
    expect(isConfiguredExternalUrl('https://tally.so/r/abc123')).toBe(true);
  });

  it('ships one configured public form per supported language', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const url = TALLY_FEEDBACK_URLS[language];
      expect(isConfiguredExternalUrl(url)).toBe(true);
      expect(new URL(url).host).toBe('tally.so');
    }
    // Separate, fully localised forms — never the same form for both languages.
    expect(TALLY_FEEDBACK_URLS.de).not.toBe(TALLY_FEEDBACK_URLS.en);
  });

  it('picks the German form for de and the English form for en', () => {
    expect(tallyFeedbackUrl('de')).toBe(TALLY_FEEDBACK_URLS.de);
    expect(tallyFeedbackUrl('en')).toBe(TALLY_FEEDBACK_URLS.en);
  });

  it('falls back to the English form for unsupported languages', () => {
    expect(tallyFeedbackUrl('fr')).toBe(TALLY_FEEDBACK_URLS.en);
    expect(tallyFeedbackUrl('de-DE')).toBe(TALLY_FEEDBACK_URLS.en);
    expect(tallyFeedbackUrl('')).toBe(TALLY_FEEDBACK_URLS.en);
  });

  it('defaults to the active app language', () => {
    setLanguage('en');
    expect(tallyFeedbackUrl()).toBe(TALLY_FEEDBACK_URLS.en);
    setLanguage('de');
    expect(tallyFeedbackUrl()).toBe(TALLY_FEEDBACK_URLS.de);
  });

  it('appends no query parameters, fragments or credentials', () => {
    for (const url of [...Object.values(TALLY_FEEDBACK_URLS), TALLY_PRIVACY_URL]) {
      const parsed = new URL(url);
      expect(parsed.search).toBe('');
      expect(parsed.hash).toBe('');
      expect(parsed.username).toBe('');
      expect(parsed.password).toBe('');
      expect(url).not.toMatch(/token|key|secret|apikey|bearer/i);
    }
  });

  it('links Tally privacy information over https', () => {
    expect(isConfiguredExternalUrl(TALLY_PRIVACY_URL)).toBe(true);
    expect(new URL(TALLY_PRIVACY_URL).host).toBe('tally.so');
  });
});
