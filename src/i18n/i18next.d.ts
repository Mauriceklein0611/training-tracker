/**
 * Statically checked translation keys: `t('nav.home')` and
 * `t('community:support.label')` are verified against the German resources at
 * compile time, so a typo or a removed key breaks the build (#31).
 */
import type { defaultNS, resources } from '@/i18n/resources';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: (typeof resources)['de'];
    // Keys are plain dotted paths; no key/namespace separator surprises.
    returnNull: false;
  }
}
