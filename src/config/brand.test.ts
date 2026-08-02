import { describe, expect, it } from 'vitest';
import {
  APP_URL,
  DEFAULT_APP_URL,
  DEFAULT_SITE_URL,
  IMPRINT_URL,
  LEGACY_APP_URL,
  LEGACY_MIGRATION_END_AT,
  appOrigin,
  isLegacyMigrationAvailable,
} from '@/config/brand';

describe('Exerivo public URL config', () => {
  it('uses secure canonical launch URLs', () => {
    expect(DEFAULT_SITE_URL).toBe('https://exerivo.com/');
    expect(DEFAULT_APP_URL).toBe('https://app.exerivo.com/');
    expect(APP_URL).toBe(DEFAULT_APP_URL);
    expect(new URL(APP_URL).protocol).toBe('https:');
    expect(IMPRINT_URL).toBe('https://exerivo.com/impressum');
  });

  it('distinguishes canonical and legacy origins without touching storage', () => {
    expect(appOrigin(new URL(APP_URL).hostname)).toBe('canonical');
    expect(appOrigin(new URL(LEGACY_APP_URL).hostname)).toBe('legacy');
    expect(appOrigin('localhost')).toBe('other');
  });

  it('expires the legacy migration entry points after one month', () => {
    expect(LEGACY_MIGRATION_END_AT).toBe('2026-09-02T00:00:00.000Z');
    expect(isLegacyMigrationAvailable(new Date('2026-09-01T23:59:59.999Z'))).toBe(true);
    expect(isLegacyMigrationAvailable(new Date(LEGACY_MIGRATION_END_AT))).toBe(false);
  });
});
