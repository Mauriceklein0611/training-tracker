/**
 * All translation resources, bundled at build time (#31).
 *
 * No translation CDN, no runtime request, no lazy namespace loading: every
 * string ships with the app so the PWA is fully usable offline in both
 * languages. Namespaces are split per feature area to keep files reviewable.
 */
import { common as deCommon } from '@/i18n/locales/de/common';
import { analytics as deAnalytics } from '@/i18n/locales/de/analytics';
import { community as deCommunity } from '@/i18n/locales/de/community';
import { comparisons as deComparisons } from '@/i18n/locales/de/comparisons';
import { data as deData } from '@/i18n/locales/de/data';
import { domain as deDomain } from '@/i18n/locales/de/domain';
import { exercises as deExercises } from '@/i18n/locales/de/exercises';
import { home as deHome } from '@/i18n/locales/de/home';
import { history as deHistory } from '@/i18n/locales/de/history';
import { library as deLibrary } from '@/i18n/locales/de/library';
import { more as deMore } from '@/i18n/locales/de/more';
import { plans as dePlans } from '@/i18n/locales/de/plans';
import { settings as deSettings } from '@/i18n/locales/de/settings';
import { session as deSession } from '@/i18n/locales/de/session';
import { storage as deStorage } from '@/i18n/locales/de/storage';
import { common as enCommon } from '@/i18n/locales/en/common';
import { analytics as enAnalytics } from '@/i18n/locales/en/analytics';
import { community as enCommunity } from '@/i18n/locales/en/community';
import { comparisons as enComparisons } from '@/i18n/locales/en/comparisons';
import { data as enData } from '@/i18n/locales/en/data';
import { domain as enDomain } from '@/i18n/locales/en/domain';
import { exercises as enExercises } from '@/i18n/locales/en/exercises';
import { home as enHome } from '@/i18n/locales/en/home';
import { history as enHistory } from '@/i18n/locales/en/history';
import { library as enLibrary } from '@/i18n/locales/en/library';
import { more as enMore } from '@/i18n/locales/en/more';
import { plans as enPlans } from '@/i18n/locales/en/plans';
import { settings as enSettings } from '@/i18n/locales/en/settings';
import { session as enSession } from '@/i18n/locales/en/session';
import { storage as enStorage } from '@/i18n/locales/en/storage';

export type Language = 'de' | 'en';

export const SUPPORTED_LANGUAGES = ['de', 'en'] as const satisfies readonly Language[];

/** Unsupported system languages fall back to English (issue #31 rule). */
export const FALLBACK_LANGUAGE: Language = 'en';

export const defaultNS = 'common';

export const resources = {
  de: {
    analytics: deAnalytics,
    common: deCommon,
    community: deCommunity,
    comparisons: deComparisons,
    data: deData,
    domain: deDomain,
    exercises: deExercises,
    home: deHome,
    history: deHistory,
    library: deLibrary,
    more: deMore,
    plans: dePlans,
    settings: deSettings,
    session: deSession,
    storage: deStorage,
  },
  en: {
    analytics: enAnalytics,
    common: enCommon,
    community: enCommunity,
    comparisons: enComparisons,
    data: enData,
    domain: enDomain,
    exercises: enExercises,
    home: enHome,
    history: enHistory,
    library: enLibrary,
    more: enMore,
    plans: enPlans,
    settings: enSettings,
    session: enSession,
    storage: enStorage,
  },
} satisfies Record<Language, Record<string, object>>;

export type Namespace = keyof (typeof resources)['de'];
