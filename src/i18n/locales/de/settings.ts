/** Settings screen strings. German is the source of truth (#31). */
export const settings = {
  title: 'Einstellungen',
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
  training: {
    sectionTitle: 'Training',
    restLabel: 'Standardpause (Sekunden)',
    restHint: 'Wird verwendet, wenn eine Übung keine eigene Pausenzeit vorgibt.',
    unitLabel: 'Einheit',
    unitHint: 'Aktuell werden alle Gewichte in Kilogramm erfasst.',
    unitKg: 'Kilogramm (kg)',
    effortLabel: 'Anstrengung erfassen',
    effortHint:
      'Welche Anstrengungsangabe der Satz-Editor anbietet. Optional — ein Satz kann immer ohne Angabe abgeschlossen werden.',
    effortRpe: 'RPE (Anstrengung)',
    effortRir: 'RIR (Wiederholungen im Tank)',
    effortNone: 'Keine Angabe',
    termsLabel: 'Fachbegriffe',
    termsHint:
      'Anfänger sehen ausführliche Labels (z. B. „Anstrengung (RPE)“), erfahrene Nutzer kompakte Fachlabels.',
    termsBeginner: 'Ausführlich (Anfänger)',
    termsExpert: 'Kompakt (erfahren)',
  },
  rest: {
    sectionTitle: 'Pausensignal',
    soundLabel: 'Ton bei abgelaufener Pause',
    soundHint:
      'Wird lokal erzeugt. Auf dem iPhone muss die App dafür zuvor einmal berührt worden sein.',
    vibrationLabel: 'Vibration bei abgelaufener Pause',
    vibrationHint:
      'Wird nicht von allen Geräten unterstützt — iOS-Browser ignorieren die Vibration.',
    voiceLabel: 'Sprachansage bei Pausenende',
    voiceHint:
      'Kündigt das Pausenende lokal per Sprachausgabe an. Auf dem iPhone muss die App dafür zuvor einmal berührt worden sein.',
    voiceUnsupported:
      'Dieser Browser unterstützt die Sprachausgabe nicht — die Einstellung bleibt dann wirkungslos.',
    testSignal: 'Signal testen',
    voiceTest: 'Pause beendet.',
  },
  screen: {
    sectionTitle: 'Bildschirm',
    keepAwakeLabel: 'Bildschirm während des Trainings aktiv halten',
    keepAwakeHint: 'Verhindert, dass sich das Display zwischen den Sätzen ausschaltet.',
    keepAwakeUnsupported:
      'Dieser Browser unterstützt die Funktion nicht — die Einstellung bleibt dann wirkungslos. Die App funktioniert normal weiter.',
  },
  appearance: {
    sectionTitle: 'Darstellung',
    colorModeLabel: 'Farbmodus',
    colorModeHint: 'Der dunkle Modus ist für das Training in Innenräumen voreingestellt.',
    dark: 'Dunkel (Gym-Modus)',
    light: 'Hell',
    system: 'Systemeinstellung folgen',
  },
  analytics: {
    sectionTitle: 'Analyse',
    rangeLabel: 'Standardzeitraum',
    range7d: '7 Tage',
    range30d: '30 Tage',
    range90d: '90 Tage',
    rangeAll: 'Gesamter Zeitraum',
  },
  weeklyGoals: {
    sectionTitle: 'Wochenziele',
    subtitle: 'Erscheinen im Verlauf über dem Kalender.',
  },
  backupReminder: {
    sectionTitle: 'Sicherungserinnerung',
    intervalLabel: 'Erinnerungsintervall (Tage)',
    intervalHint:
      '0 deaktiviert die Erinnerung. Eine Sicherung ist die einzige Möglichkeit, deine Daten auf ein anderes Gerät zu übertragen.',
    lastBackup: 'Letzte Sicherung:',
    never: 'noch nie',
  },
  ios: {
    sectionTitle: 'Auf dem iPhone installieren',
    step1: 'Diese Seite in Safari öffnen.',
    step2: 'Unten auf „Teilen“ tippen.',
    step3: '„Zum Home-Bildschirm“ auswählen.',
    step4: 'Die App künftig über das Symbol auf dem Home-Bildschirm starten.',
    note: 'Als installierte App läuft der Tracker im Vollbild und funktioniert vollständig ohne Internetverbindung.',
  },
  about: {
    sectionTitle: 'Über Exerivo',
    version: 'Version {{version}}',
    guide: 'Hilfe & Leitfaden',
    whatsNew: 'Was ist neu?',
    website: 'Exerivo-Website',
    imprint: 'Impressum',
    repeatOnboarding: 'Onboarding erneut starten',
  },
};

export type Settings = typeof settings;
