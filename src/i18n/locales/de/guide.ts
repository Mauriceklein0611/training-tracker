import type { GuideResource } from '@/features/guide/model';

export const guide: GuideResource = {
  ui: {
    title: 'Hilfe & Leitfaden',
    subtitle: 'Exerivo verstehen und sicher verwenden — vollständig offline verfügbar',
    search: 'Leitfaden durchsuchen',
    searchPlaceholder: 'z. B. Backup, RPE oder Trainingsplan',
    allCategories: 'Alle',
    noResults: 'Keine passenden Artikel gefunden.',
    updated: 'Stand',
    related: 'Passende Artikel',
    helpful: 'War das hilfreich?',
    helpfulYes: 'Ja',
    helpfulNo: 'Nein',
    helpfulThanks: 'Danke für deine Rückmeldung.',
    note: 'Hinweis',
    warning: 'Wichtig',
  },
  articles: [
    {
      id: 'was-ist-neu',
      title: 'Was ist neu?',
      category: 'Start',
      summary: 'Die wichtigsten Änderungen in Exerivo 1.0.0.',
      keywords: ['Neu', 'Release', 'Version', 'Exerivo'],
      content: [
        {
          heading: 'Exerivo 1.0.0',
          paragraphs: [
            'Training Tracker heißt jetzt Exerivo. Die neue öffentliche Website läuft unter exerivo.com, die installierbare App unter app.exerivo.com.',
          ],
          steps: [
            'Neues Exerivo-Branding, App-Symbol und PWA-Manifest.',
            'Offline-Leitfaden mit Suche, Kategorien und direkten Artikellinks.',
            'Onboarding für neue Nutzer und ein eigener Migrationshinweis für die alte App-Adresse.',
            'Automatische lokale Sicherheitskopie vor jedem Zusammenführen oder Ersetzen beim Backup-Import.',
          ],
          warning:
            'Lokale Daten wechseln nicht automatisch zwischen Domains. Erstelle an der alten Adresse ein vollständiges Backup und importiere es anschließend auf app.exerivo.com.',
        },
      ],
      relatedArticleIds: ['backup-import', 'installation', 'erste-schritte'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'erste-schritte',
      title: 'Erste Schritte',
      category: 'Start',
      summary: 'Vom ersten Öffnen bis zur ersten dokumentierten Einheit.',
      keywords: ['Start', 'Einrichtung', 'erste Einheit'],
      content: [
        {
          heading: 'In wenigen Minuten startklar',
          steps: [
            'Lege unter Pläne deinen ersten Trainingsplan an oder importiere ein Planpaket.',
            'Aktiviere den Plan und wähle auf Home die nächste Einheit.',
            'Trage während des Trainings Sätze, Wiederholungen und optional RIR oder RPE ein.',
            'Beende die Einheit, damit sie im Verlauf und in den Analysen erscheint.',
          ],
          note: 'Du kannst jederzeit auch ein freies Kraft- oder Cardiotraining starten.',
        },
      ],
      relatedArticleIds: ['trainingsplaene', 'training', 'backup-import'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'installation',
      title: 'Exerivo installieren',
      category: 'Start',
      summary: 'Die PWA auf iPhone, Android oder Desktop installieren.',
      keywords: ['PWA', 'Installation', 'iPhone', 'Android', 'Desktop'],
      content: [
        {
          heading: 'iPhone und iPad',
          steps: [
            'Öffne app.exerivo.com in Safari.',
            'Tippe auf Teilen und anschließend auf Zum Home-Bildschirm.',
            'Bestätige den Namen Exerivo.',
          ],
        },
        {
          heading: 'Android und Desktop',
          paragraphs: [
            'Öffne app.exerivo.com in einem unterstützten Browser und nutze den Installieren-Eintrag im Browsermenü oder in der Adresszeile.',
          ],
          note: 'Nach dem ersten vollständigen Laden ist die App offline verfügbar.',
        },
      ],
      relatedArticleIds: ['erste-schritte', 'backup-import', 'datenschutz'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'trainingsplaene',
      title: 'Trainingspläne',
      category: 'Planung',
      summary: 'Splits, Trainingstage, Zeitpläne und Planpakete verwalten.',
      keywords: ['Plan', 'Split', 'Trainingstag', 'Import', 'Zeitplan'],
      content: [
        {
          heading: 'Plan aufbauen',
          steps: [
            'Erstelle unter Pläne einen Plan und füge Trainingstage hinzu.',
            'Öffne einen Trainingstag und ergänze Übungen mit Zielwerten und Pausen.',
            'Lege eine freie Rotation oder feste Wochentage fest.',
            'Aktiviere den Plan, damit Home die nächste Einheit anzeigt.',
          ],
        },
        {
          heading: 'Teilen und importieren',
          paragraphs: [
            'Planpakete enthalten nur die zum Plan gehörenden Inhalte. Trainingshistorie, Körperdaten und lokale IDs werden nicht mitgeteilt.',
          ],
        },
      ],
      relatedArticleIds: ['training', 'deload', 'backup-import'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'training',
      title: 'Training dokumentieren',
      category: 'Training',
      summary: 'Sätze, RIR/RPE, Pausen und laufende Einheiten sicher erfassen.',
      keywords: ['Satz', 'RIR', 'RPE', 'Pause', 'Timer', 'e1RM'],
      content: [
        {
          heading: 'Während der Einheit',
          paragraphs: [
            'Vorwerte helfen beim schnellen Eintragen. RIR beschreibt Wiederholungen im Tank, RPE die subjektive Anstrengung. Beide Angaben sind optional.',
          ],
          steps: [
            'Gewicht und Wiederholungen eintragen.',
            'Optional Anstrengung und Satztyp ergänzen.',
            'Satz abschließen und die Pause nutzen.',
            'Die Einheit am Ende bewusst beenden.',
          ],
          warning:
            'Ein Browser- oder App-Neustart verwirft eine laufende Einheit nicht. Lösche Browserdaten jedoch niemals ohne vorheriges Backup.',
        },
      ],
      relatedArticleIds: ['erste-schritte', 'analysen', 'cardio'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'cardio',
      title: 'Cardio tracken',
      category: 'Training',
      summary: 'Dauer, Distanz, Tempo, Herzfrequenz und RPE erfassen.',
      keywords: ['Cardio', 'Laufen', 'Radfahren', 'Pace', 'Herzfrequenz'],
      content: [
        {
          heading: 'Cardio-Einheit starten',
          steps: [
            'Starte auf Home direkt ein Cardiotraining oder füge eine Cardioübung zu einer Einheit hinzu.',
            'Erfasse mindestens die für die Aktivität erforderlichen Werte.',
            'Ergänze optional Distanz, Herzfrequenz, RPE und Notizen.',
          ],
          note: 'Cardio wird getrennt von Kraftvolumen und geschätztem 1RM ausgewertet.',
        },
      ],
      relatedArticleIds: ['training', 'analysen'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'analysen',
      title: 'Analysen verstehen',
      category: 'Fortschritt',
      summary: 'Volumen, e1RM, Streaks, Muskelgruppen und Cardio richtig lesen.',
      keywords: ['Analyse', 'Volumen', 'e1RM', 'Streak', 'Muskelkarte'],
      content: [
        {
          heading: 'Nachvollziehbare Werte',
          paragraphs: [
            'Exerivo berechnet Kennzahlen ausschließlich aus deinen lokalen Einträgen. Geschätztes 1RM ist ein Vergleichswert und kein getestetes Maximalgewicht.',
            'Filtere Zeiträume, Übungen und Satztypen, bevor du Entwicklungen vergleichst.',
          ],
        },
      ],
      relatedArticleIds: ['training', 'cardio', 'deload'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'deload',
      title: 'Deload planen',
      category: 'Planung',
      summary: 'Eine kontrollierte Entlastungsphase starten und beenden.',
      keywords: ['Deload', 'Erholung', 'Intensität', 'Volumen'],
      content: [
        {
          heading: 'Entlastung statt Stillstand',
          paragraphs: [
            'Ein Deload reduziert Zielwerte für einen begrenzten Zeitraum. Deine ursprünglichen Planwerte bleiben erhalten und werden nach dem Ende wieder verwendet.',
          ],
          warning:
            'Ändere während eines Deloads nur bewusst die dauerhaften Planwerte. Die Deload-Reduktion ist davon getrennt.',
        },
      ],
      relatedArticleIds: ['trainingsplaene', 'analysen'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'backup-import',
      title: 'Backup, Import und Domainwechsel',
      category: 'Daten',
      summary: 'Alle lokalen Daten sichern, prüfen und auf eine neue Domain übertragen.',
      keywords: ['Backup', 'Export', 'Import', 'Gerätewechsel', 'Domainwechsel'],
      content: [
        {
          heading: 'Vollständiges Backup erstellen',
          steps: [
            'Öffne Mehr → Daten & Sicherung.',
            'Tippe auf Vollständige Sicherung erstellen.',
            'Speichere die JSON-Datei an einem sicheren Ort.',
          ],
        },
        {
          heading: 'Auf app.exerivo.com importieren',
          steps: [
            'Öffne die neue App-Domain und gehe zu Daten & Sicherung.',
            'Wähle deine Exerivo-Sicherungsdatei aus.',
            'Prüfe die angezeigten Datensätze und Warnungen.',
            'Wähle Zusammenführen oder bestätige bewusst Ersetzen.',
          ],
          warning:
            'Browserdaten sind an die jeweilige Domain gebunden. Die alte pages.dev-Adresse und app.exerivo.com teilen keinen lokalen Speicher.',
        },
      ],
      relatedArticleIds: ['datenschutz', 'installation', 'erste-schritte'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'datenschutz',
      title: 'Datenschutz und lokale Daten',
      category: 'Daten',
      summary: 'Welche Daten Exerivo speichert und wann etwas das Gerät verlässt.',
      keywords: ['Datenschutz', 'IndexedDB', 'lokal', 'Tally', 'Ko-fi'],
      content: [
        {
          heading: 'Standardmäßig vollständig lokal',
          paragraphs: [
            'Trainingsdaten, Körperdaten, Pläne und Einstellungen liegen in IndexedDB dieses Browsers. Exerivo besitzt kein Konto, kein Tracking und keine Cloud-Datenbank.',
            'Nur wenn du selbst eine Datei teilst oder einen externen Community-Link öffnest, verlässt bewusst ausgewählter Inhalt deinen Browser.',
          ],
          warning:
            'Das Löschen von Website-Daten kann deine Historie entfernen. Erstelle regelmäßig ein Backup.',
        },
      ],
      relatedArticleIds: ['backup-import', 'installation'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'faq',
      title: 'Häufige Fragen',
      category: 'Start',
      summary: 'Kurze Antworten zu Konto, Offlinebetrieb, Backups und Feedback.',
      keywords: ['FAQ', 'Fragen', 'Konto', 'Offline', 'Feedback'],
      content: [
        {
          heading: 'Brauche ich ein Konto?',
          paragraphs: [
            'Nein. Exerivo funktioniert ohne Registrierung und speichert deine Daten lokal im Browser.',
          ],
        },
        {
          heading: 'Funktioniert Exerivo offline?',
          paragraphs: [
            'Ja. Nach dem ersten vollständigen Laden hält der Service Worker die App-Oberfläche und den Leitfaden offline bereit.',
          ],
        },
        {
          heading: 'Wie wechsle ich Gerät oder Domain?',
          paragraphs: [
            'Erstelle ein vollständiges Backup und importiere die Datei am neuen Ziel. Prüfe die Importvorschau vor dem Bestätigen.',
          ],
        },
        {
          heading: 'Wie gebe ich Feedback?',
          paragraphs: [
            'Unter Mehr → Community öffnest du das deutsche oder englische Tally-Formular erst nach deinem bewussten Klick.',
          ],
        },
      ],
      relatedArticleIds: ['erste-schritte', 'backup-import', 'datenschutz'],
      updatedAt: '2026-08-02',
    },
  ],
};
