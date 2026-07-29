import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { applyPreference, type Language, type LanguagePreference } from '@/i18n';

/**
 * Keeps the rendered language in sync with the stored preference (#31).
 *
 * Applying a language only swaps strings — React re-renders, no route changes,
 * no reload, and nothing in IndexedDB is touched, so a running workout survives
 * a language switch untouched. While the preference is `auto` the hook also
 * follows later changes of the device language.
 */
export function useLanguage(preference: LanguagePreference): Language {
  const { i18n } = useTranslation();

  useEffect(() => {
    applyPreference(preference);
    if (preference !== 'auto' || typeof window === 'undefined') return;

    // Fired by browsers when the user reorders their preferred languages.
    const listener = () => applyPreference('auto');
    window.addEventListener('languagechange', listener);
    return () => window.removeEventListener('languagechange', listener);
  }, [preference]);

  return (i18n.resolvedLanguage ?? i18n.language) as Language;
}
