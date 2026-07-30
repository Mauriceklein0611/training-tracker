/**
 * Remaining secondary screens and reusable controls (#31).
 *
 * German is the source of truth. Domain values, export labels and stored data
 * stay language-neutral or retain their canonical format; these strings are
 * display-only.
 */
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
  screens: {
    action: {
      add: 'Hinzufügen',
      cancel: 'Abbrechen',
      change: 'Ändern',
      choose: 'Wählen',
      close: 'Schließen',
      confirm: 'Bestätigen',
      delete: 'Löschen',
      edit: 'Bearbeiten',
      new: 'Neu',
      save: 'Speichern',
      saving: 'Speichern …',
    },
    body: {
      title: 'Körperdaten',
      subtitle: 'Optional — für Trainingsauswertungen nicht erforderlich',
      form: {
        title: 'Eintrag hinzufügen',
        subtitle:
          'Pro Tag wird ein Eintrag geführt. Trägst du am selben Tag erneut etwas ein, werden die Werte ergänzt — bereits gespeicherte Angaben bleiben erhalten.',
        date: 'Datum',
        weight: 'Gewicht (kg)',
        weightPlaceholder: 'z. B. 78,5',
        bodyFat: 'Körperfett (%)',
        bodyFatPlaceholder: 'z. B. 17,5',
        measurements: 'Körpermaße (cm)',
        showMeasurements: 'Einblenden',
        hideMeasurements: 'Ausblenden',
        measurementsHint:
          'Alle Felder sind freiwillig. Trage nur ein, was du tatsächlich gemessen hast — leere Felder bleiben leer und werden nicht geschätzt.',
        note: 'Notiz',
        notePlaceholder: 'Optional, z. B. morgens nüchtern',
      },
      validation: {
        weight: 'Bitte ein Gewicht zwischen 0 und 700 kg eingeben.',
        bodyFat: 'Bitte einen Körperfettanteil zwischen 0 und 70 % eingeben.',
        measurement: 'Wert zwischen 0 und 300 cm.',
        atLeastOne: 'Bitte mindestens einen Wert eintragen.',
      },
      toast: {
        saved: 'Körperdaten gespeichert.',
        deleted: 'Eintrag gelöscht.',
      },
      empty: {
        title: 'Noch keine Einträge',
        description:
          'Das Körperdatentagebuch ist freiwillig. Gewicht, Körperfett und Umfänge fließen bewusst nicht in Volumenberechnungen ein — Körpergewichtsübungen werden nicht mit einem geschätzten Kilogramm-Volumen bewertet.',
      },
      stats: {
        weight: 'Gewicht',
        bodyFat: 'Körperfett',
        waist: 'Taille',
        chest: 'Brust',
        current: 'aktuell',
        sinceStart: '{{value}} seit Beginn',
      },
      list: {
        measurementsOnly: 'Nur Maße',
        deleteEntry: 'Eintrag vom {{date}} löschen',
      },
      measurements: {
        neckCm: 'Nacken',
        shoulderCm: 'Schultern',
        chestCm: 'Brust',
        waistCm: 'Taille',
        hipCm: 'Hüfte',
        bicepsLeftCm: 'Bizeps links',
        bicepsRightCm: 'Bizeps rechts',
        forearmLeftCm: 'Unterarm links',
        forearmRightCm: 'Unterarm rechts',
        thighLeftCm: 'Oberschenkel links',
        thighRightCm: 'Oberschenkel rechts',
        calfLeftCm: 'Wade links',
        calfRightCm: 'Wade rechts',
      },
      chart: {
        title: 'Diagramme',
        subtitle: 'Verlauf einer Messreihe',
        insufficient:
          'Sobald du eine Messreihe an mindestens zwei Tagen erfasst hast, erscheint hier ihr Verlauf.',
        series: 'Messreihe',
        range: 'Zeitraum',
        ranges: {
          '4w': '4 Wo.',
          '12w': '12 Wo.',
          '6m': '6 Mon.',
          all: 'Alles',
        },
        rangeLong: {
          '4w': '4 Wochen',
          '12w': '12 Wochen',
          '6m': '6 Monate',
          all: 'Alles',
        },
        showTrend: 'Gleitenden Trend anzeigen',
        trendHint:
          'Geglätteter Verlauf derselben Messreihe. Die Rohwerte bleiben sichtbar.',
        noMeasurements: 'Für diesen Zeitraum liegen keine Messungen vor.',
        summary:
          '{{label}}: {{amount}} Messungen im Zeitraum {{range}}. Zuletzt {{latest}}{{change}}',
        change: ', Veränderung {{value}} seit Beginn des Zeitraums.',
        noChange: '.',
        caption: '{{label}} je Messung',
        columns: {
          date: 'Datum',
          value: 'Wert',
          trend: 'Trend',
        },
        metrics: {
          weightKg: 'Körpergewicht',
          bodyFatPercent: 'Körperfettanteil',
          neckCm: 'Nacken',
          shoulderCm: 'Schultern',
          chestCm: 'Brust',
          waistCm: 'Taille',
          hipCm: 'Hüfte',
          bicepsLeftCm: 'Bizeps links',
          bicepsRightCm: 'Bizeps rechts',
          forearmLeftCm: 'Unterarm links',
          forearmRightCm: 'Unterarm rechts',
          thighLeftCm: 'Oberschenkel links',
          thighRightCm: 'Oberschenkel rechts',
          calfLeftCm: 'Wade links',
          calfRightCm: 'Wade rechts',
        },
      },
    },
    equipmentProfiles: {
      title: 'Equipment-Profile',
      subtitle: 'Optional — blenden Übungen aus, deren Equipment gerade fehlt',
      active: {
        title: 'Aktives Profil',
        subtitle: 'Wirkt beim Hinzufügen von Übungen im Plan und im Training.',
        unknown: 'Unbekannt',
        none: 'Kein Profil aktiv — alle Übungen verfügbar.',
        disable: 'Profil deaktivieren',
      },
      list: {
        title: 'Profile',
        emptyTitle: 'Noch keine Profile',
        emptyDescription:
          'Lege z. B. Zuhause, Fitnessstudio oder Hotel an und wähle das jeweils verfügbare Equipment. Beim Hinzufügen von Übungen kannst du dann auf die verfügbaren beschränken.',
        activeBadge: 'aktiv',
        noneSelected: 'Kein Equipment gewählt',
        edit: '{{name}} bearbeiten',
        delete: '{{name}} löschen',
        activate: 'Aktivieren',
      },
      toast: {
        saved: 'Profil gespeichert.',
        deleted: 'Profil gelöscht.',
      },
      deleteDialog: {
        title: 'Profil löschen?',
        description:
          'Das Equipment-Profil wird entfernt. Deine Übungen bleiben unverändert.',
      },
      editor: {
        editTitle: 'Profil bearbeiten',
        newTitle: 'Neues Profil',
        name: 'Name',
        namePlaceholder: 'z. B. Zuhause',
        equipment: 'Verfügbares Equipment',
        emptyEquipment: 'Noch kein Equipment bekannt. Füge unten welches hinzu.',
        addEquipment: 'Equipment hinzufügen',
        equipmentPlaceholder: 'z. B. Kettlebell',
      },
    },
    exercise: {
      musclePicker: {
        done: 'Fertig',
        search: 'Suchen',
        placeholder: 'Name, Kategorie oder z. B. „Lat“, „Rear Delt“',
        noMatchTitle: 'Keine Treffer',
        noMatchDescription:
          'Passe den Suchbegriff an. Du kannst nach Namen, Kategorie oder englischen Begriffen suchen.',
      },
      picker: {
        defaultTitle: 'Übung hinzufügen',
        newExercise: 'Neue Übung',
        search: 'Suchen',
        searchPlaceholder: 'Name, Muskelgruppe oder Equipment',
        onlyAvailable: 'Nur verfügbares Equipment ({{name}})',
        emptyTitle: 'Noch keine Übungen',
        noMatchTitle: 'Keine Treffer',
        emptyDescription:
          'Lege deine erste Übung an. Du bestimmst dabei, wie sie erfasst wird — mit Gewicht, mit Körpergewicht oder auf Zeit.',
        noMatchDescription: 'Passe die Suche an oder lege eine neue Übung an.',
        createFromSearch: '„{{name}}“ als neue Übung erstellen',
      },
      chips: {
        empty: 'Noch keine Muskelgruppe gewählt.',
        custom: '(eigen)',
        remove: '{{label}} entfernen',
      },
      form: {
        editTitle: 'Übung bearbeiten',
        newTitle: 'Neue Übung',
        name: 'Name',
        namePlaceholder: 'z. B. Bankdrücken',
        primaryMuscle: 'Primäre Muskelgruppe',
        secondaryMuscles: 'Sekundäre Muskelgruppen',
        equipment: 'Equipment',
        equipmentPlaceholder: 'z. B. Langhantel',
        trackingType: 'Tracking-Typ',
        cardioModality: 'Cardio-Aktivität',
        cardioModalityHint:
          'Bestimmt die Auswertung (z. B. Pace-Einheit). Das Gerät wird separat gewählt.',
        defaultCardioEquipment: 'Standardgerät',
        defaultStrengthEquipment: 'Standardausrüstung',
        defaultEquipmentHint:
          'Ausgangswert für neue Trainings. Im laufenden Training lässt sich die Ausführung temporär wechseln, ohne die Übung zu ändern.',
        weightMode: 'Gewichtskonvention',
        weightMultiplier: 'Gewichtsmultiplikator',
        weightMultiplierHint:
          'Bei zwei Kurzhanteln à 20 kg ergibt der Multiplikator 2 eine Gesamtlast von 40 kg.',
        cardioRest: 'Standardpause zwischen Intervallen (Sekunden)',
        strengthRest: 'Standardpause (Sekunden)',
        progression: 'Progression (optional)',
        progressionHint:
          'Diese Angaben verbessern die lokale Progressionsempfehlung. Ohne sie wird eine Standardsteigerung angenommen — es wird nichts geschätzt oder automatisch geändert.',
        increment: 'Kleinste Gewichtssteigerung (kg)',
        incrementPlaceholder: 'Standard: 2,5',
        availableWeights: 'Verfügbare Gewichte (kg)',
        availableWeightsHint:
          'Durch Komma trennen, z. B. 10, 12.5, 15, 17.5. Dann wird nur ein tatsächlich vorhandenes Gewicht vorgeschlagen.',
        progressionMethod: 'Bevorzugte Progression',
        progressionMethods: {
          auto: 'Automatisch (nach Tracking-Typ)',
          weight: 'Zuerst Gewicht steigern',
          reps: 'Zuerst Wiederholungen steigern',
        },
        targetRir: 'Ziel-RIR',
        targetRirHint:
          'Verbleibende Wiederholungen im Tank. Höher heißt leichter. Leer lassen, wenn du RIR nicht nutzt.',
        techniqueCues: 'Technik-Hinweise (optional)',
        techniqueCuesHint:
          'Ein kurzer Hinweis pro Zeile, z. B. Schulterblätter fixieren. Wird im Training angezeigt.',
        alternatives: 'Alternativübungen (optional)',
        alternativesHint:
          'Manuell gewählte Ersatzübungen — im Training schnell wählbar, z. B. wenn ein Gerät belegt ist.',
        notes: 'Notizen',
        notesPlaceholder: 'z. B. Griffbreite, Sitzposition',
        validation: {
          nameRequired: 'Bitte gib einen Namen ein.',
          nameTooLong: 'Der Name ist zu lang (max. 80 Zeichen).',
          nameDuplicate: 'Eine Übung mit diesem Namen existiert bereits.',
          multiplierPositive: 'Der Multiplikator muss größer als 0 sein.',
          multiplierHigh: 'Der Multiplikator wirkt unrealistisch hoch.',
          restRange: 'Die Pause muss zwischen 0 und 3600 Sekunden liegen.',
        },
        toast: {
          saved: 'Übung gespeichert.',
          created: 'Übung angelegt.',
          saveFailed: 'Die Übung konnte nicht gespeichert werden.',
        },
      },
      detail: {
        genericTitle: 'Übung',
        notFoundTitle: 'Übung nicht gefunden',
        notFoundDescription: 'Diese Übung existiert nicht mehr.',
        technique: 'Technik',
        executionAndGoal: 'Ausführung & Ziel',
        nextTarget: 'Ziel für die nächste Einheit: RIR {{value}}',
        noHistoryTitle: 'Noch keine Historie',
        noHistoryDescription:
          'Sobald du diese Übung im Training erfasst hast, erscheinen hier dein Rekord, der Verlauf und die letzten Einheiten.',
        recentSessions: 'Letzte Einheiten',
        recordAndLatest: 'Rekord & letzte Ausführung',
        bestE1rm: 'Bestes e1RM',
        estimatePrefix: 'ca. {{value}}',
        estimateHint: 'Schätzwert',
        heaviestSet: 'Schwerster Satz',
        reps: '× {{value}} Wdh.',
        latest: 'Zuletzt',
        volume: '{{value}} Volumen',
        chartTitle: 'Geschätztes 1RM — 8 Wochen',
        chartSummary:
          'Verlauf des geschätzten 1RM über {{amount}} Einheiten der letzten 8 Wochen. Schätzwert nach Epley, kein Messwert.',
        chartCaption: 'Geschätztes 1RM je Einheit',
        date: 'Datum',
      },
    },
    glossary: {
      title: 'Glossar',
      intro:
        'Kurze, verständliche Erklärungen der Fachbegriffe. Schätzwerte sind als solche gekennzeichnet und nie als Messung dargestellt.',
      example: 'Beispiel: ',
      whatMeans: 'Was bedeutet {{term}}?',
      entries: {
        rpe: {
          term: 'RPE',
          definition:
            'Rate of Perceived Exertion — wie anstrengend sich ein Satz angefühlt hat, auf einer Skala von 1 bis 10.',
          example:
            'RPE 8 heißt: hart, aber es wären noch etwa 2 Wiederholungen gegangen.',
          caveat:
            'Subjektiv und persönlich — kein Messwert und nicht zwischen Personen vergleichbar.',
        },
        rir: {
          term: 'RIR',
          definition:
            'Reps in Reserve — wie viele Wiederholungen am Satzende noch möglich gewesen wären.',
          example:
            'RIR 2 heißt: nach dem letzten Rep wären noch 2 saubere Wiederholungen gegangen.',
          caveat:
            'Eine Einschätzung. RPE und RIR lassen sich nur näherungsweise ineinander umrechnen.',
        },
        oneRm: {
          term: '1RM',
          definition:
            'One-Rep Max — das höchste Gewicht, das du für genau eine Wiederholung bewegen kannst.',
          example: 'Wenn 100 kg genau einmal gehen, ist dein 1RM 100 kg.',
          caveat:
            'Ein echtes 1RM wird tatsächlich getestet — die App misst es nicht, sondern schätzt es (siehe e1RM).',
        },
        e1rm: {
          term: 'e1RM',
          definition:
            'Geschätztes 1RM — aus Gewicht und Wiederholungen berechnet (Epley-Formel), ohne dass du ein Maximum testen musst.',
          example: '20 kg × 12 ergibt ein e1RM von etwa 28 kg (20 × (1 + 12 / 30)).',
          caveat:
            'Nur eine Schätzung, am zuverlässigsten bei 1–12 Wiederholungen und Übungen mit externem Gewicht.',
        },
        volume: {
          term: 'Trainingsvolumen',
          definition:
            'Die geleistete Gesamtlast einer Übung oder Einheit: Gewicht × Wiederholungen, über alle gewerteten Sätze summiert.',
          example: '3 Sätze mit 50 kg × 10 ergeben 1.500 kg Volumen.',
          caveat:
            'Nur für Übungen mit sinnvoller Kilogramm-Last; Körpergewichts- oder Zeitübungen liefern kein kg-Volumen.',
        },
        workingSet: {
          term: 'Arbeitssatz',
          definition:
            'Ein echter Belastungssatz, der zum Trainingsziel zählt — im Gegensatz zu einem Aufwärmsatz.',
          example: 'Nach 2 Aufwärmsätzen zählen die 3 schweren Sätze als Arbeitssätze.',
          caveat:
            'Aufwärm-, Drop- und Versagenssätze werden je nach Auswertung getrennt behandelt.',
        },
        intensity: {
          term: 'Intensität',
          definition:
            'Wie schwer das Gewicht relativ zu deinem Maximum ist — je näher am 1RM, desto höher die Intensität.',
          example:
            '5 Wiederholungen mit 90 % des 1RM sind hohe Intensität; 15 leichte Wiederholungen sind niedrige Intensität.',
          caveat:
            'Intensität ist nicht dasselbe wie Trainingsvolumen oder subjektive Anstrengung.',
        },
        deload: {
          term: 'Deload',
          definition:
            'Eine bewusst leichtere Woche mit reduzierten Zielwerten, um Erholung zu ermöglichen.',
          example: 'In der Deload-Woche werden Gewicht oder Sätze planmäßig gesenkt.',
          caveat:
            'Eine geplante Reduktion — sie wird in Analyse und Vergleich markiert und nicht als Rückschritt gewertet.',
        },
        pace: {
          term: 'Pace',
          definition:
            'Das Tempo im Cardio, meist als Zeit pro Strecke (z. B. min/km) oder als Geschwindigkeit (km/h).',
          example: '5 km in 25 Minuten ergeben eine Pace von 5:00 min/km.',
          caveat: 'Nur berechenbar, wenn sowohl Dauer als auch Distanz erfasst sind.',
        },
        restAdherence: {
          term: 'Pausentreue',
          definition:
            'Wie gut die tatsächlichen Satzpausen zur geplanten Pausenzeit passen.',
          example:
            'Zielpause 90 s, tatsächlich im Schnitt 95 s — die Pausentreue ist hoch.',
          caveat:
            'Abweichungen zeigen nur den zeitlichen Vergleich und sind keine Qualitätsbewertung.',
        },
        muscleGroups: {
          term: 'Primäre & sekundäre Muskelgruppe',
          definition:
            'Primär sind die Hauptmuskeln einer Übung, sekundär die unterstützend beteiligten.',
          example:
            'Beim Bankdrücken ist die Brust primär, Trizeps und vordere Schulter sind sekundär.',
          caveat:
            'Die Zuordnung beschreibt Trainingsbeteiligung und ersetzt keine medizinische Beurteilung.',
        },
      },
    },
    privacy: {
      title: 'Datenschutz',
      sections: {
        local: {
          title: 'Alle Daten bleiben auf diesem Gerät',
          text: 'Übungen, Trainingspläne, Trainingseinheiten, Sätze, Pausen, Notizen und Körpergewicht werden ausschließlich in der lokalen Datenbank (IndexedDB) dieses Browsers gespeichert.',
        },
        noServer: {
          title: 'Keine Übertragung an einen Server',
          text: 'Die App besitzt kein Backend und ruft nach dem Laden der Anwendung keine externen Dienste, Schriftarten oder Programmierschnittstellen auf. Es findet keine Übertragung deiner Trainingsdaten statt.',
        },
        noAccount: {
          title: 'Kein Benutzerkonto',
          text: 'Es gibt keine Registrierung, keine Anmeldung und keine Benutzerverwaltung. Die App weiß nicht, wer du bist.',
        },
        noTracking: {
          title: 'Kein Tracking, keine Werbung',
          text: 'Es werden keine Cookies gesetzt, keine Analysedienste eingebunden und keine Nutzungsdaten erhoben oder verschickt.',
        },
        browserData: {
          title: 'Löschen von Browserdaten entfernt die Historie',
          text: 'Wenn du die Websitedaten deines Browsers löschst, die App vom Home-Bildschirm entfernst oder den privaten Modus verwendest, kann deine Trainingshistorie verloren gehen.',
        },
        backups: {
          title: 'Regelmäßige Sicherungen werden empfohlen',
          text: 'Erstelle regelmäßig eine vollständige Sicherung unter „Daten & Sicherung“ und lege die Datei an einem Ort ab, den du selbst kontrollierst. Nur so kannst du auf ein anderes Gerät wechseln.',
        },
        aiExport: {
          title: 'Der KI-Export bleibt in deiner Hand',
          text: 'Der Export für eine externe KI wird ausschließlich lokal erzeugt und als Datei gespeichert. Erst wenn du diese Datei selbst weitergibst — etwa in einen Chat hochlädst — verlassen die enthaltenen Daten dein Gerät. Die Datei enthält nur das, was du vor dem Export ausgewählt hast.',
        },
      },
      communityTitle: 'Community-Links: Ko-fi und Feedback-Formular',
      communityText:
        'Die Einträge im Community-Bereich öffnen externe Dienste erst dann in einem neuen Tab, wenn du sie selbst auswählst (Ko-fi für freiwillige Unterstützung, Tally für Feedback). Beim normalen Start der App werden keine Ko-fi- oder Tally-Ressourcen geladen — keine Iframes, Widgets oder Skripte. Trainingsdaten, Körperdaten, Notizen und Sicherungen werden nicht automatisch übertragen, und es werden keine Parameter mit App-Daten angehängt. Was du freiwillig in das Formular einträgst, wird von Tally verarbeitet; Kontakt-E-Mail und Screenshot sind ausdrücklich freiwillig. Zahlungen über Ko-fi sind freiwillige Unterstützung und keine steuerlich absetzbare Spende.',
      tallyLink: 'Datenschutzinformationen von Tally',
    },
    checkIn: {
      filled: 'Ausgefüllt · antippen',
      noValue: 'keine Angabe',
      reset: 'zurücksetzen',
      optional: 'Optional',
      pre: {
        title: 'Vor dem Training',
        subtitle: 'Optional · in wenigen Sekunden',
        energy: 'Energie',
        sleep: 'Schlafqualität',
        motivation: 'Motivation',
        soreness: 'Muskelkater',
        pain: 'Schmerz oder Einschränkung',
        painPlaceholder: 'z. B. Knie zwickt, Schulter vorsichtig',
        note: 'Notiz',
      },
      post: {
        title: 'Nach dem Training',
        subtitle: 'Optional · wie war die Einheit?',
        quality: 'Trainingsqualität',
        difficulty: 'Schwierigkeit',
        satisfaction: 'Zufriedenheit',
        note: 'Notiz',
      },
      scale: {
        low: 'niedrig',
        high: 'hoch',
        bad: 'schlecht',
        good: 'gut',
        none: 'keiner',
        strong: 'stark',
        top: 'top',
        easy: 'leicht',
        veryHard: 'sehr schwer',
      },
    },
    weeklyGoals: {
      intro:
        'Ziele sind freiwillig und helfen nur beim Dranbleiben. Leere Felder bedeuten „kein Ziel“.',
      noGoal: 'kein Ziel',
      sessions: 'Trainingseinheiten pro Woche',
      workingSets: 'Arbeitssätze pro Woche',
      workingSetsHint: 'Nur Kraft — Cardio zählt hier nicht mit.',
      cardioMinutes: 'Cardio-Minuten pro Woche',
      cardioDistance: 'Cardio-Distanz pro Woche (km)',
      cardioSessions: 'Cardio-Einheiten pro Woche',
      exerciseGoals: 'Übungsziele (optional)',
      noExerciseGoals:
        'Noch keine übungsspezifischen Ziele. Du kannst z. B. „Kniebeugen 2× pro Woche“ festlegen.',
      removeExerciseGoal: 'Ziel für {{name}} entfernen',
      goal: 'Ziel',
      sessionsPerWeek: 'Einheiten/Woche',
      setsPerWeek: 'Sätze/Woche',
      amount: 'Anzahl',
      addExercise: 'Übung hinzufügen',
      chooseExercise: 'Übung wählen …',
    },
    dialog: {
      close: 'Schließen',
      cancel: 'Abbrechen',
      confirm: 'Bestätigen',
    },
    errorBoundary: {
      title: 'Es ist ein unerwarteter Fehler aufgetreten',
      text: 'Deine Trainingsdaten sind davon nicht betroffen — sie liegen weiterhin lokal auf diesem Gerät. Du kannst die Ansicht neu laden und normal weiterarbeiten.',
      retry: 'Erneut versuchen',
      reload: 'App neu laden',
    },
  },
};

export type More = typeof more;
