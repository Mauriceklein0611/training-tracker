/**
 * All translation resources, bundled at build time (#31).
 *
 * No translation CDN, no runtime request, no lazy namespace loading: every
 * string ships with the app so the PWA is fully usable offline in both
 * languages. Namespaces are split per feature area to keep files reviewable.
 */
import { common as deCommon } from '@/i18n/locales/de/common';
import { community as deCommunity } from '@/i18n/locales/de/community';
import { settings as deSettings } from '@/i18n/locales/de/settings';
import { common as enCommon } from '@/i18n/locales/en/common';
import { community as enCommunity } from '@/i18n/locales/en/community';
import { settings as enSettings } from '@/i18n/locales/en/settings';

export type Language = 'de' | 'en';

export const SUPPORTED_LANGUAGES = ['de', 'en'] as const satisfies readonly Language[];

/** Unsupported system languages fall back to English (issue #31 rule). */
export const FALLBACK_LANGUAGE: Language = 'en';

export const defaultNS = 'common';

export const resources = {
  de: {
    common: deCommon,
    community: deCommunity,
    settings: deSettings,
  },
  en: {
    common: enCommon,
    community: enCommunity,
    settings: enSettings,
  },
} satisfies Record<Language, Record<string, object>>;

export type Namespace = keyof (typeof resources)['de'];
