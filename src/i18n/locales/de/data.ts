export const data = {
  title: 'Daten & Sicherung',
  busy: {
    creating: 'Wird erstellt …',
    preparing: 'Wird vorbereitet …',
  },
  toast: {
    backupCreated: 'Sicherung erstellt.',
    exportFailed: 'Export fehlgeschlagen: {{detail}}',
    exportFailedGeneric: 'Export fehlgeschlagen.',
    fileReadFailed: 'Die Datei konnte nicht gelesen werden.',
    historyDeleted: 'Trainingshistorie gelöscht.',
    deleteFailed: 'Löschen fehlgeschlagen.',
    resetFailed: 'Zurücksetzen fehlgeschlagen.',
    dataReplaced: 'Daten ersetzt: {{value}} Datensätze importiert.',
    dataMerged: 'Zusammengeführt: {{added}} neu, {{skipped}} bereits vorhanden.',
    importFailed: 'Import fehlgeschlagen: {{detail}} Es wurden keine Daten verändert.',
    importFailedGeneric: 'Import fehlgeschlagen. Es wurden keine Daten verändert.',
    completePeriod: 'Bitte den Zeitraum vervollständigen.',
    shareFailed: 'Teilen fehlgeschlagen: {{detail}}',
    shareFailedGeneric: 'Teilen fehlgeschlagen.',
    aiExportCreated: 'KI-Export erstellt.',
    csvCreated: 'CSV-Datei erstellt.',
    promptCopied: 'Analyseanweisung in die Zwischenablage kopiert.',
    promptCopyBlocked:
      'Kopieren wurde vom Browser blockiert. Bitte markiere den Text manuell.',
  },
  backup: {
    title: 'Vollständige Sicherung',
    subtitle:
      'Enthält alle Übungen, Pläne, Trainingseinheiten, Sätze, Körpergewichtseinträge und Einstellungen. Diese Datei kann vollständig wieder eingespielt werden.',
    create: 'Vollständige Sicherung erstellen',
    last: 'Letzte Sicherung:',
    never: 'noch nie',
    localHint:
      'Die Datei wird lokal erzeugt und nur dorthin gespeichert, wo du sie ablegst.',
  },
  restore: {
    title: 'Sicherung wiederherstellen',
    subtitle:
      'Wähle eine zuvor erstellte Sicherungsdatei. Sie wird zuerst geprüft — importiert wird erst nach deiner Bestätigung.',
    choose: 'Sicherungsdatei auswählen',
    unusable: 'Die Datei konnte nicht verwendet werden',
    invalidJson:
      'Die Datei ist keine gültige JSON-Datei und konnte nicht gelesen werden.',
    invalidFile: 'Die Sicherungsdatei ist ungültig.',
    newerExport:
      'Diese Datei wurde mit einem neueren Exportformat erstellt. Bitte aktualisiere zuerst die App.',
    newerDatabase:
      'Diese Datei stammt aus einer neueren Datenbankversion. Bitte aktualisiere zuerst die App.',
    orphanExercises:
      '{{value}} Übungseinträge verweisen auf fehlende Trainingseinheiten.',
    orphanSetOne: '1 Satz verweist auf einen fehlenden Übungseintrag.',
    orphanSets: '{{value}} Sätze verweisen auf fehlende Übungseinträge.',
    activeSessions:
      'Die Datei enthält {{value}} aktive Trainingseinheiten. Beim Import bleibt nur die neueste aktiv.',
  },
  periodValidation: {
    startRequired: 'Bitte ein Startdatum wählen.',
    endRequired: 'Bitte ein Enddatum wählen.',
    invalidDate: 'Ungültiges Datum.',
    invalidOrder: 'Das Enddatum darf nicht vor dem Startdatum liegen.',
  },
  aiExport: {
    title: 'Export für eine KI-Analyse',
    subtitle:
      'Eine aufbereitete, selbsterklärende Datei für ChatGPT und vergleichbare Sprachmodelle. Sie enthält ausschließlich das, was du hier auswählst.',
    period: {
      label: 'Zeitraum',
      all: 'Gesamte Historie',
      days30: 'Letzte 30 Tage',
      days90: 'Letzte 90 Tage',
      custom: 'Benutzerdefiniert',
      from: 'Von',
      to: 'Bis',
    },
    options: {
      notes: 'Notizen einschließen',
      notesHint: 'Notizen zu Trainings, Übungen und Körpergewicht.',
      body: 'Körperdaten einschließen',
      bodyHint: 'Gewicht, Körperfettanteil und Umfangsmaße.',
      warmup: 'Aufwärmsätze einschließen',
      warmupHint:
        'Standardmäßig ausgeschlossen, damit Volumen und Bestleistungen nicht verfälscht werden.',
    },
    contents: {
      heading: 'Die Datei enthält:',
      entireHistory: 'gesamte Trainingshistorie',
      customPeriod: 'Zeitraum {{from}} bis {{to}}',
      lastDays: 'letzte {{value}} Tage',
      training: 'Übungen, Sätze, Gewichte, Wiederholungen, Pausen',
      warmupIncluded: 'inklusive Aufwärmsätze',
      warmupExcluded: 'ohne Aufwärmsätze',
      notesIncluded: 'inklusive Notizen',
      notesExcluded: 'ohne Notizen',
      bodyIncluded: 'inklusive Körperdaten',
      bodyExcluded: 'ohne Körperdaten',
      contextIncluded: 'deine Angaben zum Trainingskontext',
      contextExcluded: 'keine Kontextangaben hinterlegt',
      planning:
        'Planungskontext: aktiver Plan, Planziele, Trainingsblöcke und aktiver Deload',
    },
    privacyHint:
      'Die Datei wird lokal erzeugt. Beim Teilen entscheidet dein Gerät, welche Apps angeboten werden — die App überträgt selbst nichts.',
    share: 'Mit KI analysieren',
    saveFile: 'Nur als Datei speichern',
    copyPrompt: 'Analyseanweisung kopieren',
    showPrompt: 'Anweisung anzeigen',
    shareTitle: 'Trainingsdaten zur Analyse',
    shareResult: {
      sharedFile: 'Datei wurde zum Teilen übergeben.',
      sharedText: 'Daten wurden als Text zum Teilen übergeben.',
      cancelled: 'Teilen abgebrochen.',
      downloadedCopied:
        'Teilen wird hier nicht unterstützt. Die Datei wurde gespeichert und der Inhalt in die Zwischenablage kopiert.',
      downloaded: 'Teilen wird hier nicht unterstützt. Die Datei wurde gespeichert.',
      failed: 'Die Datei konnte nicht erzeugt werden.',
    },
  },
  context: {
    title: 'Angaben zum Trainingskontext',
    subtitle:
      'Vollständig freiwillig. Diese Angaben werden nur in den KI-Export übernommen und beeinflussen keine Berechnung in der App.',
    edit: 'Angaben bearbeiten',
    add: 'Angaben hinzufügen',
    goal: 'Trainingsziel',
    goalPlaceholder: 'z. B. Kraftaufbau im Oberkörper',
    days: 'Gewünschte Trainingstage pro Woche',
    daysPlaceholder: 'z. B. 4',
    equipment: 'Verfügbares Equipment',
    equipmentPlaceholder: 'z. B. Langhantel, Kurzhanteln bis 30 kg, Klimmzugstange',
    phase: 'Aktuelle Phase',
    phaseNone: 'Keine Angabe',
    phaseBulk: 'Aufbau',
    phaseMaintenance: 'Erhaltung',
    phaseCut: 'Diät',
    limitations: 'Einschränkungen oder Hinweise',
    limitationsPlaceholder: 'z. B. linke Schulter empfindlich beim Überkopfdrücken',
    focus: 'Gewünschter Analyseschwerpunkt',
    focusPlaceholder: 'z. B. Warum stagniert mein Bankdrücken?',
    emptyHint: 'Leere Felder erscheinen nicht in der Exportdatei.',
  },
  csv: {
    title: 'CSV-Export',
    subtitle: 'Für Tabellenkalkulationen. UTF-8 mit korrekt maskierten Sonderzeichen.',
    sets: 'Sätze als CSV',
    sessions: 'Trainingseinheiten als CSV',
    exercises: 'Übungen als CSV',
    body: 'Körperdaten als CSV',
  },
  danger: {
    title: 'Gefahrenzone',
    subtitle:
      'Diese Aktionen können nicht rückgängig gemacht werden. Erstelle vorher eine Sicherung.',
    deleteHistory: 'Trainingshistorie löschen',
    deleteHistoryHint:
      'Löscht alle Trainingseinheiten, Sätze, Pausen und aktive Entwürfe. Übungen, Trainingspläne und Körperdaten bleiben erhalten.',
    resetApp: 'App vollständig zurücksetzen',
    resetAppHint:
      'Löscht alle lokalen Daten: Übungen, Pläne, Trainings, Körperdaten, Equipment-Profile, KI-Analysen und Einstellungen. Die App startet danach wie frisch installiert.',
    replaceTitle: 'Alle vorhandenen Daten ersetzen?',
    replaceDescription:
      'Sämtliche Übungen, Pläne, Trainingseinheiten, Sätze und Körpergewichtseinträge auf diesem Gerät werden gelöscht und durch den Inhalt der Datei ersetzt. Dieser Schritt kann nicht rückgängig gemacht werden. Erstelle vorher eine Sicherung, wenn du dir nicht sicher bist.',
    replaceConfirm: 'Daten endgültig ersetzen',
    historyTitle: 'Trainingshistorie löschen?',
    historyDescription:
      'Alle Trainingseinheiten, Sätze, Pausen und aktive Entwürfe werden endgültig gelöscht. Übungen, Trainingspläne und Körperdaten bleiben erhalten. Dieser Schritt kann nicht rückgängig gemacht werden.',
    historyConfirm: 'Historie endgültig löschen',
    resetTitle: 'App vollständig zurücksetzen?',
    resetDescription:
      'Alle lokalen Daten werden unwiderruflich gelöscht — Übungen, Pläne, Trainings, Körperdaten, Equipment-Profile, KI-Analysen und Einstellungen. Erstelle vorher unbedingt eine Sicherung, falls du die Daten behalten möchtest.',
    resetKeyword: 'ZURÜCKSETZEN',
    resetInput: 'Zum Bestätigen „{{keyword}}“ eingeben',
    deleteAll: 'Alles löschen',
  },
  importDialog: {
    title: 'Sicherung importieren',
    file: 'Datei: {{name}}',
    merge: 'Zusammenführen',
    replace: 'Ersetzen',
    records: 'Enthaltene Datensätze',
    notes: 'Hinweise',
    mergeLabel: 'Zusammenführen:',
    mergeDescription:
      'fügt nur Datensätze hinzu, die noch nicht vorhanden sind. Vorhandene Daten bleiben unverändert — nichts wird überschrieben.',
    replaceLabel: 'Ersetzen:',
    replaceDescription:
      'löscht zuerst alle aktuellen Trainingsdaten auf diesem Gerät und spielt anschließend die Datei ein.',
    counts: {
      exercises: 'Übungen',
      trainingPlans: 'Trainingspläne',
      workoutTemplates: 'Trainingstage',
      templateExercises: 'Planübungen',
      templateVersions: 'Wiederherstellungspunkte',
      workoutSessions: 'Trainingseinheiten',
      sessionExercises: 'Übungen in Einheiten',
      workoutSets: 'Sätze',
      bodyWeightEntries: 'Körpergewichtseinträge',
      aiAnalyses: 'KI-Analysen',
      equipmentProfiles: 'Equipment-Profile',
      planSchedules: 'Zeitpläne',
      scheduleEntries: 'Zeitplan-Einträge',
      workoutUnitTemplates: 'Übungseinheiten (Bibliothek)',
      workoutUnitTemplateExercises: 'Übungen in Bibliothekseinheiten',
      planUsagePeriods: 'Plan-Nutzungszeiträume',
      planDeloadPeriods: 'Deload-Zeiträume',
      planScheduleExceptions: 'Zeitplan-Ausnahmen',
      aiExports: 'KI-Export-Vermerke',
      planImports: 'Plan-Import-Vermerke',
    },
  },
  aiAnalyses: {
    title: 'KI-Analysen',
    subtitle: 'Antwortdatei importieren — nichts wird ungeprüft übernommen',
    status: {
      pending: 'offen',
      applied: 'übernommen',
      skipped: 'übersprungen',
      conflict: 'Konflikt',
      invalid: 'ungültig',
    },
    fields: {
      sets: 'Sätze',
      repMin: 'Wdh. von',
      repMax: 'Wdh. bis',
      restSeconds: 'Pause (s)',
      durationSeconds: 'Dauer (s)',
      distanceMeters: 'Distanz (m)',
      rpe: 'RPE',
      description: 'Beschreibung',
    },
    planFallback: 'Plan',
    apply: 'Übernehmen',
    feedback: {
      strengths: 'Stärken',
      observations: 'Beobachtungen',
      recommendations: 'Empfehlungen',
      next: 'Empfohlene nächste Analyse ab: {{date}}',
    },
    toast: {
      rejected: 'Datei abgelehnt: {{detail}}',
      invalidJson: 'Die Datei ist kein gültiges JSON.',
      invalidResponse: 'Die Antwortdatei entspricht nicht dem erwarteten Format.',
      proposalWithoutChange: 'Ein Vorschlag enthält keine Änderung.',
      duplicateProposal: 'Eine Vorschlags-ID kommt mehrfach vor.',
      expectedMissing: 'Bei einem Vorschlag fehlt ein erwarteter Ausgangswert.',
      appliedOne:
        '1 Vorschlag übernommen — du kannst den Import unten rückgängig machen.',
      appliedOther:
        '{{value}} Vorschläge übernommen — du kannst den Import unten rückgängig machen.',
      savedWithoutChanges: 'Analyse gespeichert. Keine Planänderung übernommen.',
      undoRestoredOne: 'Import rückgängig gemacht — 1 Plan zurückgesetzt.',
      undoRestoredOther: 'Import rückgängig gemacht — {{value}} Pläne zurückgesetzt.',
      undoWithoutPlans:
        'Import als rückgängig markiert. Die betroffenen Pläne gibt es nicht mehr.',
      undoUnavailable: 'Dieser Import lässt sich nicht mehr rückgängig machen.',
      deleted: 'Analyse gelöscht.',
    },
    review: {
      title: 'Import prüfen',
      discard: 'Verwerfen',
      duplicate: 'Diese Antwortdatei wurde offenbar schon einmal importiert.',
      proposals: 'Planvorschläge ({{value}})',
      proposalHint:
        'Nur ausgewählte, gültige Vorschläge werden übernommen. Vorher wird vom aktuellen Plan ein Wiederherstellungspunkt gesichert, sodass du den letzten Import jederzeit rückgängig machen kannst.',
      noProposals: 'Diese Analyse enthält keine Planvorschläge.',
      applySelected: 'Übernehmen ({{selected}} von {{total}})',
      save: 'Analyse speichern',
    },
    import: {
      title: 'Antwortdatei importieren',
      subtitle: 'Die von der KI erzeugte training-ai-response.json',
      choose: 'Datei wählen',
      paste: '… oder JSON einfügen',
      pastePlaceholder: '{ "format": "training-ai-response", … }',
      checkPaste: 'Eingefügtes JSON prüfen',
    },
    history: {
      title: 'Frühere Analysen',
      emptyTitle: 'Noch keine Analysen',
      emptyDescription:
        'Exportiere deine Daten unter Daten & Sicherung, lade sie bei ChatGPT hoch und importiere hier die Antwortdatei. Feedback wird nur angezeigt; Planänderungen wendest du bewusst und einzeln an.',
      fallbackTitle: 'KI-Analyse',
      proposalOne: '1 Vorschlag',
      proposalOther: '{{value}} Vorschläge',
      applied: ' · {{value}} übernommen',
      deleteLabel: 'Analyse löschen',
      undone: 'rückgängig gemacht',
      undo: 'Import rückgängig machen',
    },
    undoDialog: {
      title: 'Import rückgängig machen?',
      description:
        'Die von diesem Import betroffenen Pläne werden auf den Stand vor dem Import zurückgesetzt. Spätere manuelle Änderungen an diesen Plänen gehen dabei verloren. Trainingsverlauf und abgeschlossene Sessions bleiben unberührt.',
      confirm: 'Rückgängig machen',
    },
    deleteDialog: {
      title: 'Analyse löschen?',
      description:
        'Das gespeicherte Feedback und die Vorschlagsliste werden entfernt. Bereits übernommene Planänderungen bleiben bestehen.',
    },
    serviceMessage: {
      targetPlanMissing: 'Der Zielplan existiert nicht.',
      targetExerciseMissing: 'Die Zielübung existiert nicht in diesem Plan.',
      invalidRepRange: 'Der minimale Wiederholungswert ist größer als der maximale.',
      changedValue:
        'Erwartet {{field}}={{expected}}, aktuell {{current}}. Der Plan wurde seit dem Export geändert.',
      unset: 'nicht gesetzt',
      descriptionMismatch: 'Die aktuelle Beschreibung weicht von der erwarteten ab.',
      targetExerciseGone: 'Die Zielübung existiert nicht mehr.',
      planChanged: 'Der Plan wurde inzwischen geändert.',
      targetPlanGone: 'Der Zielplan existiert nicht mehr.',
      descriptionChanged: 'Die Beschreibung wurde inzwischen geändert.',
      duplicateBlocked:
        'Diese Antwortdatei wurde bereits importiert — Planänderungen werden nicht erneut angewendet.',
      referenceMissing:
        'Ohne gültige Exportreferenz können keine Planänderungen übernommen werden.',
      referenceUnknown:
        'Der referenzierte Export ist unbekannt — Planänderungen sind gesperrt.',
      referenceMismatch:
        'Die Exportreferenz passt nicht zum gespeicherten Export — Planänderungen sind gesperrt.',
      plansChanged:
        'Deine Pläne haben sich seit diesem Export geändert. Vorschläge mit abweichenden Ausgangswerten werden als Konflikt markiert.',
      unknown: 'Der Vorschlag kann nicht angewendet werden.',
    },
  },
};

export type Data = typeof data;
