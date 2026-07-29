/** Settings screen strings. German is the source of truth (#31). */
export const settings = {
  language: {
    sectionTitle: 'Sprache',
    label: 'App-Sprache',
    hint: 'Automatisch folgt der Sprache deines Geräts. Nicht unterstützte Sprachen werden auf Englisch angezeigt. Der Wechsel wirkt sofort — ein laufendes Training bleibt unberührt.',
    auto: 'Automatisch (Systemsprache)',
    de: 'Deutsch',
    en: 'English',
    /** Announced after switching so screen-reader users get confirmation. */
    changed: 'Sprache geändert',
  },
};

export type Settings = typeof settings;
