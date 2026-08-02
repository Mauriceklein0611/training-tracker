import type { GuideResource } from '@/features/guide/model';

export const guide: GuideResource = {
  ui: {
    title: 'Hilfe & Leitfaden',
    subtitle: 'Konkrete Anleitungen für Planung, Training, Auswertung und Datensicherung',
    search: 'Leitfaden durchsuchen',
    searchPlaceholder: 'z. B. Backup, RIR, Planrotation oder KI-Analyse',
    allCategories: 'Alle',
    noResults: 'Keine passenden Artikel gefunden.',
    updated: 'Stand',
    related: 'Das hilft dir als Nächstes',
    note: 'Tipp',
    warning: 'Wichtig',
  },
  articles: [
    {
      id: 'was-ist-neu',
      title: 'Was ist neu?',
      category: 'Start',
      summary:
        'Die wichtigsten Änderungen in Exerivo 1.0.0 und was du jetzt beachten solltest.',
      keywords: ['Neu', 'Release', 'Version', 'Exerivo', 'Domainwechsel'],
      content: [
        {
          heading: 'Training Tracker heißt jetzt Exerivo',
          paragraphs: [
            'Die öffentliche Website erreichst du unter exerivo.com. Die eigentliche installierbare Trainings-App läuft unter app.exerivo.com. Alle neuen Einstiege führen direkt auf diese Adresse.',
            'Deine Trainingsdaten bleiben weiterhin lokal in deinem Browser. Durch den neuen Namen oder das neue App-Symbol werden keine Daten automatisch übertragen oder gelöscht.',
          ],
        },
        {
          heading: 'Neu in Version 1.0.0',
          steps: [
            'Neues Exerivo-Branding, App-Symbol und PWA-Manifest.',
            'Ausführlicher Offline-Leitfaden mit Suche, Kategorien und direkten Artikellinks.',
            'Einmaliges Onboarding für neue Nutzer sowie ein zeitlich begrenzter Backup-Weg von der alten App.',
            'Automatische lokale Sicherheitskopie vor jedem Zusammenführen oder Ersetzen beim Backup-Import.',
          ],
          warning:
            'Lokale Daten wechseln nicht automatisch zwischen Domains. Falls du die alte App verwendet hast, exportiere dort ein vollständiges Backup und importiere es anschließend auf app.exerivo.com.',
        },
      ],
      relatedArticleIds: ['backup-import', 'installation', 'erste-schritte'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'erste-schritte',
      title: 'Erste Schritte',
      category: 'Start',
      summary:
        'Eine vollständige Tour vom ersten Öffnen bis zur ersten ausgewerteten Einheit.',
      keywords: ['Start', 'Einrichtung', 'erste Einheit', 'Tutorial', 'Home'],
      content: [
        {
          heading: '1. Grundlegende Einstellungen wählen',
          steps: [
            'Öffne Mehr → Einstellungen.',
            'Wähle Deutsch, English oder die automatische Gerätesprache.',
            'Lege fest, ob du Anstrengung mit RIR, RPE oder gar nicht erfassen möchtest.',
            'Prüfe Standardpause, Pausensignal und Bildschirm-Wachhalten.',
          ],
          note: 'Alle Einstellungen lassen sich später ändern und beeinflussen vorhandene Trainingsdaten nicht.',
        },
        {
          heading: '2. Entscheide dich für Plan oder freies Training',
          paragraphs: [
            'Ein Trainingsplan eignet sich für wiederkehrende Einheiten mit festen Übungen und Zielwerten. Freies Training ist sinnvoll für spontane Einheiten ohne vorherige Planung.',
          ],
          steps: [
            'Für einen Plan: Öffne Pläne, erstelle einen Plan und füge mindestens einen Trainingstag hinzu.',
            'Für einen spontanen Start: Wähle auf Home Freies Training oder Cardio.',
          ],
        },
        {
          heading: '3. Erste Einheit dokumentieren',
          steps: [
            'Starte die vorgeschlagene Einheit auf Home oder ein freies Training.',
            'Trage pro Satz Gewicht, Wiederholungen und optional RIR/RPE ein.',
            'Schließe den Satz ab; erst dann zählt er für Verlauf und Auswertung.',
            'Beende am Schluss die gesamte Einheit und prüfe die Zusammenfassung.',
          ],
        },
        {
          heading: '4. Fortschritt ansehen und sichern',
          steps: [
            'Öffne Verlauf, um einzelne Einheiten und deinen Kalender zu prüfen.',
            'Öffne Analyse, um Trends erst nach mehreren vergleichbaren Einheiten zu bewerten.',
            'Erstelle unter Mehr → Daten & Sicherung dein erstes vollständiges Backup.',
          ],
          warning:
            'Ohne Backup können gelöschte Browserdaten oder ein Gerätewechsel deine lokale Historie unzugänglich machen.',
        },
      ],
      relatedArticleIds: ['trainingsplaene', 'training', 'backup-import'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'installation',
      title: 'Exerivo installieren',
      category: 'Start',
      summary:
        'Die PWA auf iPhone, Android oder Desktop installieren und zuverlässig offline nutzen.',
      keywords: ['PWA', 'Installation', 'iPhone', 'Android', 'Desktop', 'Offline'],
      content: [
        {
          heading: 'iPhone und iPad',
          steps: [
            'Öffne app.exerivo.com direkt in Safari.',
            'Tippe in Safari auf Teilen.',
            'Wähle Zum Home-Bildschirm und bestätige den Namen Exerivo.',
            'Starte Exerivo danach über das neue Symbol auf dem Home-Bildschirm.',
          ],
          note: 'Andere iOS-Browser zeigen die Installationsoption möglicherweise nicht vollständig an. Verwende für die Installation Safari.',
        },
        {
          heading: 'Android',
          steps: [
            'Öffne app.exerivo.com in Chrome oder einem PWA-fähigen Browser.',
            'Nutze App installieren oder Zum Startbildschirm hinzufügen im Browsermenü.',
            'Bestätige die Installation und öffne Exerivo anschließend über das App-Symbol.',
          ],
        },
        {
          heading: 'Windows, macOS und Linux',
          paragraphs: [
            'In Chrome oder Edge erscheint die Installation meist in der Adresszeile oder im Browsermenü. Die installierte PWA öffnet sich in einem eigenen Fenster, verwendet aber weiterhin den lokalen Speicher dieses Browserprofils.',
          ],
        },
        {
          heading: 'Offlinebetrieb testen',
          steps: [
            'Öffne Exerivo einmal vollständig mit Internetverbindung.',
            'Warte, bis die Startseite geladen ist.',
            'Öffne die App später offline erneut. Oberfläche und Leitfaden sollten verfügbar sein.',
          ],
          warning:
            'Privatmodus und das Löschen von Website-Daten sind nicht für dauerhafte Trainingsdaten geeignet.',
        },
      ],
      relatedArticleIds: ['erste-schritte', 'backup-import', 'datenschutz'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'trainingsplaene',
      title: 'Trainingspläne Schritt für Schritt',
      category: 'Planung',
      summary:
        'Pläne, Trainingstage, Zielwerte, Rotation, Wochenplan und Planpakete verständlich einrichten.',
      keywords: [
        'Plan',
        'Split',
        'Trainingstag',
        'Import',
        'Zeitplan',
        'Rotation',
        'Wochenplan',
      ],
      content: [
        {
          heading: 'Was gehört zu einem Trainingsplan?',
          paragraphs: [
            'Ein Plan ist der übergeordnete Rahmen, zum Beispiel Ganzkörper, Push/Pull/Beine oder Marathon-Vorbereitung. Darin liegen Trainingstage wie Push, Pull oder Intervalllauf. Jeder Trainingstag enthält Übungen mit Ziel-Sätzen, Wiederholungsbereichen, Dauer oder Distanz und einer geplanten Pause.',
            'Nur ein aktivierter Plan liefert auf Home automatisch die nächste Einheit. Andere Pläne bleiben gespeichert und können später wieder aktiviert werden.',
          ],
        },
        {
          heading: 'Einen neuen Plan erstellen',
          steps: [
            'Öffne Pläne und tippe auf Neuer Plan.',
            'Vergib einen klaren Namen und optional ein Ziel oder eine Beschreibung.',
            'Speichere den Plan und öffne anschließend seine Übersicht.',
            'Füge den ersten Trainingstag hinzu, zum Beispiel Ganzkörper A.',
            'Erstelle weitere Tage nur dann, wenn sie sich in Übungen oder Zielwerten unterscheiden.',
          ],
          note: 'Beginne lieber mit einem einfachen Plan. Übungen, Reihenfolge und Zielwerte lassen sich später bearbeiten.',
        },
        {
          heading: 'Einen Trainingstag aufbauen',
          steps: [
            'Öffne den gewünschten Trainingstag und wähle Bearbeiten.',
            'Füge Übungen aus deiner Bibliothek hinzu oder erstelle eine eigene Übung.',
            'Lege pro Übung die Anzahl der Arbeitssätze und passende Zielwerte fest.',
            'Ergänze Wiederholungsbereich, RIR/RPE-Ziel, Pausenzeit oder Cardio-Vorgaben nur dort, wo sie sinnvoll sind.',
            'Ordne die Übungen in der Reihenfolge an, in der du sie meistens ausführst.',
            'Speichere und prüfe die Zusammenfassung des Trainingstags.',
          ],
          warning:
            'Plan-Zielwerte sind Vorgaben, keine bereits erbrachten Leistungen. Tatsächliche Werte entstehen erst in einer abgeschlossenen Einheit.',
        },
        {
          heading: 'Freie Rotation oder feste Wochentage',
          paragraphs: [
            'Bei einer freien Rotation schlägt Exerivo nach jeder abgeschlossenen Einheit den nächsten Trainingstag der Reihenfolge vor. Das passt gut, wenn deine Trainingstage von Woche zu Woche wechseln.',
            'Mit festen Wochentagen ordnest du Einheiten bestimmten Tagen zu. Das eignet sich für einen stabilen Wochenrhythmus. Ausgelassene oder zusätzlich absolvierte Einheiten kannst du weiterhin bewusst auswählen.',
          ],
          steps: [
            'Öffne in der Planübersicht den Zeitplan.',
            'Wähle Rotation oder feste Wochentage.',
            'Ordne bei festen Tagen jedem gewünschten Wochentag einen Trainingstag zu.',
            'Prüfe auf Home, welche Einheit als Nächstes angezeigt wird.',
          ],
        },
        {
          heading: 'Plan aktivieren, wechseln oder pausieren',
          paragraphs: [
            'Beim Aktivieren wird dieser Plan zur Grundlage für Home und die nächste vorgeschlagene Einheit. Ein Wechsel löscht weder alte Pläne noch deine Trainingshistorie.',
          ],
          steps: [
            'Öffne den gewünschten Plan.',
            'Tippe auf Aktivieren und bestätige die Auswahl.',
            'Prüfe Zykluswoche, nächste Einheit und gegebenenfalls den Zeitplan.',
          ],
        },
        {
          heading: 'Plan teilen oder importieren',
          paragraphs: [
            'Ein Planpaket enthält die Struktur des ausgewählten Plans und die dafür benötigten Übungen. Es enthält keine absolvierte Trainingshistorie, keine Körperdaten und keine Einstellungen.',
          ],
          steps: [
            'Exportiere in der Planübersicht ein Planpaket als Datei.',
            'Teile nur diese Planpaket-Datei, wenn jemand deinen Plan übernehmen soll.',
            'Beim Import zeigt Exerivo zuerst eine Vorschau und mögliche Konflikte.',
            'Bestätige den Import erst, wenn Name, Trainingstage und Übungen plausibel sind.',
          ],
        },
      ],
      relatedArticleIds: ['uebungen-und-equipment', 'training', 'deload'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'uebungen-und-equipment',
      title: 'Übungen und Equipment einrichten',
      category: 'Planung',
      summary:
        'Eigene Übungen, Erfassungsarten, Gewichtslogik, Alternativen und Equipment-Profile richtig nutzen.',
      keywords: [
        'Übung',
        'Equipment',
        'Gewicht',
        'Kurzhantel',
        'Alternative',
        'Muskelgruppe',
      ],
      content: [
        {
          heading: 'Die richtige Erfassungsart wählen',
          paragraphs: [
            'Gewichtsübungen erfassen Last und Wiederholungen. Körpergewichts- oder reine Wiederholungsübungen benötigen nicht zwingend eine Kilogrammzahl. Zeitbasierte Übungen verwenden Dauer; Cardio kann zusätzlich Distanz, Tempo oder Herzfrequenz verwenden.',
          ],
          warning:
            'Eine falsche Erfassungsart verfälscht spätere Vergleiche. Ändere sie nur, wenn die Übung tatsächlich anders dokumentiert werden soll.',
        },
        {
          heading: 'Eigene Übung anlegen',
          steps: [
            'Öffne Mehr → Übungen und wähle Neue Übung.',
            'Vergib einen eindeutigen Namen und wähle primäre sowie sekundäre Muskelgruppen.',
            'Lege Erfassungsart, Standard-Equipment und Standardpause fest.',
            'Ergänze optional Gewichtsschritte, verfügbare Gewichte, Technikhinweise und Alternativen.',
            'Speichere die Übung und füge sie anschließend einem Plan oder freien Training hinzu.',
          ],
        },
        {
          heading: 'Kurzhanteln und Gewichtsmultiplikator',
          paragraphs: [
            'Wenn du bei zwei Kurzhanteln das Gewicht pro Hand eingibst, kann ein Multiplikator von 2 die gesamte bewegte Last abbilden. Trägst du bereits das Gesamtgewicht ein, bleibt der Multiplikator bei 1.',
          ],
          note: 'Bleibe bei einer Übung dauerhaft bei derselben Konvention, damit Volumen und Verlauf vergleichbar bleiben.',
        },
        {
          heading: 'Equipment-Profile verwenden',
          steps: [
            'Öffne Mehr → Equipment und erstelle etwa Gym, Zuhause oder Hotel.',
            'Markiere das Equipment, das an diesem Ort verfügbar ist.',
            'Aktiviere das passende Profil.',
            'Nutze im Übungspicker den Filter für verfügbares Equipment.',
          ],
          note: 'Ein Profil blendet unpassende Übungen im Picker aus; bestehende Pläne und Übungen werden nicht gelöscht.',
        },
      ],
      relatedArticleIds: ['trainingsplaene', 'training', 'analysen'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'training',
      title: 'Training vollständig dokumentieren',
      category: 'Training',
      summary:
        'Eine laufende Einheit bedienen, Satztypen verstehen und saubere Vergleichsdaten erzeugen.',
      keywords: ['Satz', 'RIR', 'RPE', 'Pause', 'Timer', 'Warm-up', 'Drop-Satz'],
      content: [
        {
          heading: 'Einheit starten und vorbereiten',
          steps: [
            'Starte die vorgeschlagene Planeinheit auf Home oder wähle Freies Training.',
            'Prüfe Übungen, Zielwerte und Reihenfolge, bevor du den ersten Satz abschließt.',
            'Füge bei Bedarf eine Übung hinzu, ersetze sie oder ändere nur für diese Einheit das Equipment.',
            'Nutze den optionalen Check-in, wenn du Energie, Schlaf oder Beschwerden für deine eigene Einordnung festhalten möchtest.',
          ],
        },
        {
          heading: 'Einen Kraftsatz erfassen',
          steps: [
            'Trage das tatsächlich verwendete Gewicht und die sauberen Wiederholungen ein.',
            'Wähle bei Bedarf Warm-up, Arbeitssatz, Drop-Satz oder Ausbelastung.',
            'Ergänze RIR oder RPE nur, wenn du die Anstrengung sinnvoll einschätzen kannst.',
            'Tippe auf Satz abschließen. Erst jetzt wird der Satz gespeichert und der Pausentimer gestartet.',
          ],
          note: 'Vorwerte sind nur eine Eingabehilfe. Übernimm sie nicht ungeprüft, wenn sich Übungsausführung oder Equipment geändert haben.',
        },
        {
          heading: 'RIR und RPE kurz erklärt',
          paragraphs: [
            'RIR bedeutet Wiederholungen im Tank: RIR 2 heißt, dass ungefähr zwei saubere Wiederholungen möglich gewesen wären. RPE beschreibt die subjektive Anstrengung auf einer Skala bis 10; RPE 8 entspricht ungefähr RIR 2. Beides sind persönliche Schätzungen, keine Messwerte.',
          ],
        },
        {
          heading: 'Pausen und unterbrochene Einheiten',
          paragraphs: [
            'Der Timer verwendet eine absolute Endzeit. Dadurch bleibt die Pause auch nach gesperrtem Bildschirm oder kurzem App-Wechsel nachvollziehbar. Eine laufende Einheit wird lokal gespeichert und kann nach einem Neustart fortgesetzt werden.',
          ],
          warning:
            'Website-Daten während einer laufenden Einheit zu löschen entfernt auch den lokalen Zwischenstand.',
        },
        {
          heading: 'Einheit beenden und korrigieren',
          steps: [
            'Prüfe, ob alle tatsächlich absolvierten Sätze abgeschlossen sind.',
            'Beende die Einheit bewusst und ergänze optional den Check-out.',
            'Kontrolliere die Zusammenfassung und öffne die Einheit bei Bedarf später im Verlauf.',
            'Korrigiere fehlerhafte abgeschlossene Sätze im Verlauf, statt eine zweite Einheit anzulegen.',
          ],
        },
      ],
      relatedArticleIds: ['trainingsplaene', 'analysen', 'cardio'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'cardio',
      title: 'Cardio sinnvoll tracken',
      category: 'Training',
      summary:
        'Dauer, Distanz, Pace, Geschwindigkeit, Herzfrequenz und Intervalle korrekt erfassen.',
      keywords: ['Cardio', 'Laufen', 'Radfahren', 'Pace', 'Herzfrequenz', 'Intervall'],
      content: [
        {
          heading: 'Cardio-Einheit starten',
          steps: [
            'Starte auf Home ein freies Cardiotraining oder öffne einen Cardio-Trainingstag deines Plans.',
            'Wähle Aktivität und Gerät, damit Exerivo passende Felder und Einheiten verwendet.',
            'Erfasse mindestens die Dauer; ergänze Distanz, wenn Pace oder Geschwindigkeit berechnet werden soll.',
            'Trage optional durchschnittliche Herzfrequenz, RPE und eine Notiz ein.',
          ],
        },
        {
          heading: 'Pace und Geschwindigkeit verstehen',
          paragraphs: [
            'Beim Laufen ist Pace meist Minuten pro Kilometer. Beim Radfahren ist Kilometer pro Stunde oft leichter lesbar. Exerivo kann diese Werte nur berechnen, wenn Dauer und Distanz vorhanden und plausibel sind.',
          ],
          note: 'Ein fehlender Wert bleibt bewusst leer; Exerivo erfindet keine Distanz oder Herzfrequenz.',
        },
        {
          heading: 'Intervalle dokumentieren',
          paragraphs: [
            'Für wiederholte Belastungsabschnitte kannst du einzelne Cardio-Segmente mit Dauer oder Distanz abschließen und geplante Pausen verwenden. So bleiben Belastung und Erholung getrennt nachvollziehbar.',
          ],
          warning:
            'Cardio-Kennzahlen werden getrennt von Kraftvolumen und geschätztem 1RM ausgewertet.',
        },
      ],
      relatedArticleIds: ['training', 'analysen', 'trainingsplaene'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'analysen',
      title: 'Analysen richtig lesen',
      category: 'Fortschritt',
      summary:
        'Volumen, e1RM, Häufigkeit, Muskelgruppen und Cardio-Trends ohne Fehlinterpretation nutzen.',
      keywords: [
        'Analyse',
        'Volumen',
        'e1RM',
        'Streak',
        'Muskelkarte',
        'Vergleich',
        'Trend',
      ],
      content: [
        {
          heading: 'Erst filtern, dann vergleichen',
          steps: [
            'Wähle einen Zeitraum, der genügend vergleichbare Einheiten enthält.',
            'Filtere bei Bedarf auf Plan, Trainingstag, Übung oder Satztyp.',
            'Vergleiche gleichartige Übungen und dieselbe Gewichtskonvention.',
            'Berücksichtige Pausen, Krankheit, Deloads und geändertes Equipment.',
          ],
        },
        {
          heading: 'Trainingsvolumen',
          paragraphs: [
            'Volumen ist die Summe aus Gewicht × Wiederholungen für geeignete Kraftsätze. Mehr Volumen kann aus mehr Sätzen, mehr Wiederholungen oder mehr Gewicht entstehen und ist allein noch kein Qualitätsurteil.',
          ],
          warning:
            'Körpergewichts-, zeitbasierte und andere Übungen ohne sinnvolle Kilogrammlast werden nicht mit einem erfundenen kg-Volumen versehen.',
        },
        {
          heading: 'Geschätztes 1RM (e1RM)',
          paragraphs: [
            'Das e1RM schätzt aus Gewicht und Wiederholungen eine theoretische Ein-Wiederholungs-Leistung. Es eignet sich eher für Trends derselben Übung als für Vergleiche zwischen verschiedenen Übungen oder Personen.',
          ],
          note: 'Werte aus sehr hohen Wiederholungszahlen sind weniger aussagekräftig. Das e1RM ist kein getestetes Maximalgewicht.',
        },
        {
          heading: 'Muskelgruppen und Trainingshäufigkeit',
          paragraphs: [
            'Die Muskelansicht basiert auf den primären und sekundären Muskelgruppen deiner Übungen. Unvollständige Übungszuordnungen führen deshalb zu unvollständigen Karten. Häufigkeit und Streaks zeigen Regelmäßigkeit, bewerten aber nicht automatisch Trainingsqualität oder Erholung.',
          ],
        },
        {
          heading: 'Was ein sinnvoller Trend ist',
          paragraphs: [
            'Suche über mehrere Wochen nach einer wiederholbaren Entwicklung: mehr Wiederholungen bei gleichem Gewicht, höheres Gewicht im gleichen Wiederholungsbereich, bessere Cardio-Pace bei ähnlicher Belastung oder stabilere Trainingshäufigkeit.',
            'Ein einzelner schlechter Tag ist noch kein Rückschritt. Nutze Notizen und Check-ins, um Ausreißer einzuordnen.',
          ],
        },
      ],
      relatedArticleIds: ['training', 'cardio', 'ki-analysen'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'ki-analysen',
      title: 'KI-Analyse sicher verwenden',
      category: 'Fortschritt',
      summary:
        'Daten bewusst exportieren, extern analysieren und Antwortdateien kontrolliert importieren.',
      keywords: ['KI', 'AI', 'Export', 'Antwortdatei', 'ChatGPT', 'Vorschlag', 'Import'],
      content: [
        {
          heading: 'So funktioniert der Rundweg',
          paragraphs: [
            'Exerivo führt selbst keine KI-Anfrage aus. Die App erstellt lokal eine strukturierte Exportdatei. Du entscheidest, ob und bei welchem externen Dienst du diese Datei hochlädst. Anschließend kann Exerivo eine passende Antwortdatei prüfen und anzeigen.',
          ],
          steps: [
            'Öffne Mehr → Daten & Sicherung und erstelle einen Export für KI-Analyse.',
            'Wähle Zeitraum und optionale Inhalte bewusst aus.',
            'Lade die Datei bei einem externen KI-Dienst hoch und fordere eine Antwort im vorgesehenen Exerivo-Format an.',
            'Speichere die Antwort als JSON-Datei.',
            'Öffne Mehr → KI-Analysen und importiere oder füge die Antwort ein.',
          ],
        },
        {
          heading: 'Was beim Import passiert',
          paragraphs: [
            'Feedback wird zunächst nur als Text angezeigt. Vorgeschlagene Planänderungen erscheinen einzeln mit vorherigem und neuem Wert. Nichts wird allein durch das Auswählen einer Datei ungeprüft übernommen.',
          ],
          steps: [
            'Lies Zusammenfassung, Beobachtungen und Empfehlungen.',
            'Prüfe jeden Änderungsvorschlag und mögliche Konflikte.',
            'Wähle nur Vorschläge aus, die du wirklich übernehmen möchtest.',
            'Bestätige die Auswahl bewusst. Eine begrenzte Rückgängig-Funktion wird angeboten, wenn Wiederherstellungspunkte verfügbar sind.',
          ],
        },
        {
          heading: 'Doppelte oder veraltete Antworten',
          paragraphs: [
            'Exerivo erkennt bekannte Exportreferenzen und doppelte Antwortdateien. Wenn sich dein Plan seit dem Export geändert hat, werden abweichende Ausgangswerte als Konflikt markiert, statt aktuelle Werte still zu überschreiben.',
          ],
        },
        {
          heading: 'Datenschutz',
          warning:
            'Die Datei verlässt dein Gerät erst, wenn du sie selbst teilst. Prüfe vor dem Upload, welche Zeiträume, Notizen und Körperdaten du in den Export aufgenommen hast. Für die Verarbeitung beim externen KI-Dienst gelten dessen Datenschutzregeln.',
        },
      ],
      relatedArticleIds: ['analysen', 'backup-import', 'datenschutz'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'deload',
      title: 'Deload planen',
      category: 'Planung',
      summary:
        'Eine zeitlich begrenzte Entlastungsphase starten, verstehen und sauber beenden.',
      keywords: ['Deload', 'Erholung', 'Intensität', 'Volumen', 'Entlastung'],
      content: [
        {
          heading: 'Was ein Deload in Exerivo macht',
          paragraphs: [
            'Ein Deload reduziert die angezeigten Zielwerte für einen begrenzten Zeitraum. Die ursprünglichen Planwerte bleiben als Basis erhalten und werden nach dem Ende wieder verwendet. Abgeschlossene Einheiten behalten ihre tatsächlich eingetragenen Werte.',
          ],
        },
        {
          heading: 'Deload einrichten',
          steps: [
            'Öffne den aktiven Plan und wähle die Deload-Funktion.',
            'Lege Zeitraum und gewünschte Reduktion fest.',
            'Prüfe die reduzierten Zielwerte vor der nächsten Einheit.',
            'Dokumentiere im Training weiterhin die tatsächlich absolvierten Werte.',
          ],
        },
        {
          heading: 'Deload beenden',
          paragraphs: [
            'Nach Ablauf endet die temporäre Reduktion und die normalen Zielwerte werden wieder angezeigt. In Analysen und Vergleichen bleibt die Entlastungsphase als Kontext erkennbar.',
          ],
          warning:
            'Bearbeite während eines Deloads dauerhafte Planwerte nur bewusst. Eine normale Planänderung ist von der temporären Deload-Reduktion getrennt.',
        },
      ],
      relatedArticleIds: ['trainingsplaene', 'analysen', 'training'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'backup-import',
      title: 'Backup, Import und Domainwechsel',
      category: 'Daten',
      summary:
        'Alle lokalen Daten sichern, eine Vorschau prüfen und sicher auf Domain oder Gerät übertragen.',
      keywords: [
        'Backup',
        'Export',
        'Import',
        'Gerätewechsel',
        'Domainwechsel',
        'Zusammenführen',
        'Ersetzen',
      ],
      content: [
        {
          heading: 'Warum ein Backup notwendig ist',
          paragraphs: [
            'Exerivo besitzt kein Konto und keine Cloud-Datenbank. Deine Daten gehören zum Browser, Gerät und zur geöffneten Domain. Ein vollständiges Backup ist deshalb der einzige verlässliche Weg für Wiederherstellung, Gerätewechsel oder Domainwechsel.',
          ],
        },
        {
          heading: 'Vollständiges Backup erstellen',
          steps: [
            'Öffne Mehr → Daten & Sicherung.',
            'Tippe auf Vollständige Sicherung erstellen.',
            'Warte, bis die JSON-Datei heruntergeladen oder zum Speichern angeboten wird.',
            'Speichere sie außerhalb des Browser-Downloadordners, zum Beispiel in einem selbst gewählten Cloud-Laufwerk oder auf einem externen Datenträger.',
            'Behalte mindestens die letzte funktionierende Sicherung.',
          ],
          note: 'Erstelle vor größeren Imports, Browserwechseln oder dem Löschen von Website-Daten immer eine neue Sicherung.',
        },
        {
          heading: 'Von der alten App zu app.exerivo.com wechseln',
          steps: [
            'Öffne die alte pages.dev-App und gehe dort zu Mehr → Daten & Sicherung.',
            'Erstelle und speichere ein vollständiges Backup.',
            'Öffne app.exerivo.com und dort ebenfalls Mehr → Daten & Sicherung.',
            'Wähle die gerade erstellte Sicherungsdatei aus.',
            'Prüfe die Vorschau und bestätige den gewünschten Importmodus.',
            'Kontrolliere anschließend Pläne, Verlauf und Einstellungen auf der neuen Domain.',
          ],
          warning:
            'Die alte und die neue Domain teilen keinen lokalen Speicher. Nur das Öffnen der neuen Adresse überträgt keine Daten.',
        },
        {
          heading: 'Zusammenführen oder Ersetzen?',
          paragraphs: [
            'Zusammenführen ergänzt Datensätze und ist meist sinnvoll, wenn auf dem Ziel bereits neue Daten vorhanden sind. Ersetzen setzt den Zielbestand auf den Inhalt des Backups zurück und ist nur sinnvoll, wenn die Sicherung bewusst den vollständigen Zielzustand darstellen soll.',
            'Vor beiden Varianten erstellt Exerivo lokal eine Sicherheitskopie des bisherigen Bestands. Lies trotzdem die Vorschau und Warnungen vollständig.',
          ],
        },
        {
          heading: 'Nach dem Import prüfen',
          steps: [
            'Vergleiche die Anzahl deiner Pläne und letzten Einheiten.',
            'Öffne mindestens einen Plan und einen Verlaufseintrag.',
            'Prüfe Sprache, Pausen und weitere Einstellungen.',
            'Erstelle auf der neuen Domain ein frisches vollständiges Backup.',
          ],
        },
      ],
      relatedArticleIds: ['datenschutz', 'installation', 'erste-schritte'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'datenschutz',
      title: 'Datenschutz und lokale Daten',
      category: 'Daten',
      summary:
        'Verstehen, wo Exerivo Daten speichert und wann Informationen das Gerät verlassen.',
      keywords: ['Datenschutz', 'IndexedDB', 'lokal', 'Tally', 'Ko-fi', 'KI'],
      content: [
        {
          heading: 'Was lokal gespeichert wird',
          paragraphs: [
            'Übungen, Pläne, Trainingseinheiten, Sätze, Pausen, Notizen, Körperdaten, Einstellungen und importierte KI-Analysen liegen in der lokalen Browserdatenbank dieser Domain.',
            'Exerivo hat kein Nutzerkonto, keine Werbeintegration und kein Nutzungs-Tracking. Die App kann deine lokalen Inhalte nicht aus der Ferne auslesen.',
          ],
        },
        {
          heading: 'Wann Daten das Gerät verlassen',
          paragraphs: [
            'Nur eine von dir bewusst exportierte und anschließend geteilte Datei verlässt den Browser. Dasselbe gilt für Texte oder Screenshots, die du selbst in Tally, Ko-fi oder einen externen KI-Dienst eingibst.',
          ],
          note: 'Beim normalen Start lädt Exerivo keine eingebetteten Tally- oder Ko-fi-Widgets.',
        },
        {
          heading: 'Was die lokale Speicherung bedeutet',
          steps: [
            'Ein anderer Browser auf demselben Gerät sieht die Daten nicht automatisch.',
            'Eine andere Domain besitzt einen getrennten lokalen Speicher.',
            'Privatfenster können Daten nach dem Schließen löschen.',
            'Das Löschen von Website-Daten kann die gesamte Historie entfernen.',
          ],
        },
        {
          heading: 'Deine Schutzroutine',
          steps: [
            'Verwende die kanonische Adresse app.exerivo.com.',
            'Erstelle regelmäßig vollständige Backups.',
            'Prüfe Exporte vor dem Teilen auf Notizen und optionale Körperdaten.',
            'Bewahre Sicherungsdateien an einem von dir kontrollierten Ort auf.',
          ],
        },
      ],
      relatedArticleIds: ['backup-import', 'ki-analysen', 'installation'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'faq',
      title: 'Häufige Fragen und Problemlösungen',
      category: 'Start',
      summary:
        'Schnelle Antworten zu Konto, Offlinebetrieb, fehlenden Daten, Installation und Feedback.',
      keywords: ['FAQ', 'Fragen', 'Konto', 'Offline', 'Feedback', 'Fehler', 'Daten weg'],
      content: [
        {
          heading: 'Brauche ich ein Konto?',
          paragraphs: [
            'Nein. Exerivo funktioniert ohne Registrierung und speichert deine Daten lokal im Browser.',
          ],
        },
        {
          heading:
            'Warum sehe ich meine Daten auf einem anderen Gerät oder Browser nicht?',
          paragraphs: [
            'Lokaler Speicher wird nicht automatisch synchronisiert. Erstelle auf dem bisherigen Gerät ein vollständiges Backup und importiere es im gewünschten Browser oder auf dem neuen Gerät.',
          ],
        },
        {
          heading: 'Funktioniert Exerivo offline?',
          paragraphs: [
            'Ja. Öffne die App zunächst einmal vollständig online. Danach sind Oberfläche und Leitfaden offline verfügbar. Externe Links und ein erstmaliges Update benötigen weiterhin Internet.',
          ],
        },
        {
          heading: 'Warum fehlt eine Kennzahl in der Analyse?',
          paragraphs: [
            'Exerivo zeigt nur berechenbare Werte. Pace benötigt Dauer und Distanz, e1RM benötigt eine geeignete Gewichtsübung, und Muskelkarten benötigen zugeordnete Muskelgruppen. Fehlende Werte werden nicht geschätzt.',
          ],
        },
        {
          heading: 'Die App zeigt eine neue Version an. Gehen Daten verloren?',
          paragraphs: [
            'Ein normales App-Update lässt die lokale Datenbank bestehen. Erstelle trotzdem regelmäßig Backups und lösche nicht gleichzeitig die Website-Daten deines Browsers.',
          ],
        },
        {
          heading: 'Wie gebe ich echtes Feedback oder melde einen Fehler?',
          paragraphs: [
            'Öffne Mehr → Community und wähle das deutsche oder englische Tally-Formular. Der Link wird erst nach deinem Klick geöffnet; du entscheidest selbst, welche Beschreibung, Kontaktadresse oder Screenshots du übermittelst.',
          ],
        },
      ],
      relatedArticleIds: ['erste-schritte', 'backup-import', 'analysen'],
      updatedAt: '2026-08-02',
    },
  ],
};
