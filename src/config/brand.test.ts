import { describe, expect, it } from 'vitest';
import {
  APP_URL,
  DEFAULT_APP_URL,
  DEFAULT_SITE_URL,
  LEGACY_APP_URL,
  appOrigin,
} from '@/config/brand';

describe('Exerivo public URL config', () => {
  it('uses secure canonical launch URLs', () => {
    expect(DEFAULT_SITE_URL).toBe('https://exerivo.com/');
    expect(DEFAULT_APP_URL).toBe('https://app.exerivo.com/');
    expect(new URL(APP_URL).protocol).toBe('https:');
  });

  it('distinguishes canonical and legacy origins without touching storage', () => {
    expect(appOrigin(new URL(APP_URL).hostname)).toBe('canonical');
    expect(appOrigin(new URL(LEGACY_APP_URL).hostname)).toBe('legacy');
    expect(appOrigin('localhost')).toBe('other');
  });
});
