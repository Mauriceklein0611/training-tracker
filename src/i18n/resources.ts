/**
 * All translation resources, bundled at build time (#31).
 *
 * No translation CDN, no runtime request, no lazy namespace loading: every
 * string ships with the app so the PWA is fully usable offline in both
 * languages. Namespaces are split per feature area to keep files reviewable.
 */
import { common as deCommon } from '@/i18n/locales/de/common';
import { community as deCommunity } from '@/i18n/locales/de/community';
import { domain as deDomain } from '@/i18n/locales/de/domain';
import { home as deHome } from '@/i18n/locales/de/home';
import { more as deMore } from '@/i18n/locales/de/more';
import { settings as deSettings } from '@/i18n/locales/de/settings';
import { storage as deStorage } from '@/i18n/locales/de/storage';
import { common as enCommon } from '@/i18n/locales/en/common';
import { community as enCommunity } from '@/i18n/locales/en/community';
import { domain as enDomain } from '@/i18n/locales/en/domain';
import { home as enHome } from '@/i18n/locales/en/home';
import { more as enMore } from '@/i18n/locales/en/more';
import { settings as enSettings } from '@/i18n/locales/en/settings';
import { storage as enStorage } from '@/i18n/locales/en/storage';

export type Language = 'de' | 'en';

export const SUPPORTED_LANGUAGES = ['de', 'en'] as const satisfies readonly Language[];

/** Unsupported system languages fall back to English (issue #31 rule). */
export const FALLBACK_LANGUAGE: Language = 'en';

export const defaultNS = 'common';

export const resources = {
  de: {
    common: deCommon,
    community: deCommunity,
    domain: deDomain,
    home: deHome,
    more: deMore,
    settings: deSettings,
    storage: deStorage,
  },
  en: {
    common: enCommon,
    community: enCommunity,
    domain: enDomain,
    home: enHome,
    more: enMore,
    settings: enSettings,
    storage: enStorage,
  },
} satisfies Record<Language, Record<string, object>>;

export type Namespace = keyof (typeof resources)['de'];
