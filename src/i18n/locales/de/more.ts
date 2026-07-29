/** The "Mehr" hub: group headings and entries (#31). */
export const more = {
  title: 'Mehr',
  groups: {
    training: 'Training',
    progress: 'Fortschritt',
    data: 'Daten',
    app: 'App',
  },
  library: {
    label: 'Bibliothek',
    description: 'Übungseinheiten und Übungen — wiederverwendbar',
  },
  exercises: {
    label: 'Übungen',
    description: 'Anlegen, bearbeiten, archivieren',
  },
  equipment: {
    label: 'Equipment-Profile',
    description: 'Verfügbares Equipment je Ort — filtert die Übungsauswahl',
  },
  bodyData: {
    label: 'Körperdaten',
    description: 'Gewicht, Körperfett und Umfangsmaße',
  },
  aiAnalyses: {
    label: 'KI-Analysen',
    description: 'Antwortdatei importieren, Feedback und geprüfte Vorschläge',
  },
  backup: {
    label: 'Daten & Sicherung',
    description: 'Backup, Wiederherstellung, KI- und CSV-Export, Zurücksetzen',
  },
  storage: {
    label: 'Lokale Speicherung',
    description: 'Speicherstatus und Datenbankversion',
  },
  settings: {
    label: 'Einstellungen',
    description: 'Training, Pausen, Sprache, Darstellung, Ton und Erinnerungen',
  },
  glossary: {
    label: 'Glossar',
    description: 'Fachbegriffe wie RPE, RIR, e1RM und Volumen erklärt',
  },
  privacy: {
    label: 'Datenschutz',
    description: 'Was gespeichert wird — und was nicht',
  },
};

export type More = typeof more;
