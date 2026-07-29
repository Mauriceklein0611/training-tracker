import { describe, expect, it } from 'vitest';
import {
  KOFI_URL,
  TALLY_FEEDBACK_URL,
  isConfiguredExternalUrl,
} from '@/config/externalLinks';

describe('external links config', () => {
  it('ships the public Ko-fi URL and no credentials', () => {
    expect(KOFI_URL).toBe('https://ko-fi.com/trainingtracker');
    expect(isConfiguredExternalUrl(KOFI_URL)).toBe(true);
    // No query/secret material appended to the public link.
    expect(KOFI_URL).not.toMatch(/[?&](token|key|secret|api)/i);
  });

  it('treats an unconfigured Tally URL as not a link', () => {
    // Default ships empty until the public form URL is filled in.
    expect(TALLY_FEEDBACK_URL).toBe('');
    expect(isConfiguredExternalUrl(TALLY_FEEDBACK_URL)).toBe(false);
  });

  it('only accepts well-formed https URLs', () => {
    expect(isConfiguredExternalUrl('')).toBe(false);
    expect(isConfiguredExternalUrl('http://ko-fi.com/x')).toBe(false);
    expect(isConfiguredExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isConfiguredExternalUrl('not a url')).toBe(false);
    expect(isConfiguredExternalUrl('https://tally.so/r/abc123')).toBe(true);
  });
});
