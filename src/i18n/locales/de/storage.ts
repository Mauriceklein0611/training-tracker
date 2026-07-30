/** "Lokale Speicherung" screen: what the browser keeps and for how long (#31). */
export const storage = {
  title: 'Lokale Speicherung',
  persistent: {
    sectionTitle: 'Persistenter Speicher',
    subtitle:
      'Verhindert, dass der Browser deine Trainingsdaten bei Speicherknappheit automatisch löscht.',
    checking: 'Status wird ermittelt …',
    unsupported:
      'Dieser Browser stellt die Storage-API nicht bereit. Die App funktioniert normal weiter, der Browser kann die Daten aber theoretisch bei Speichermangel entfernen. Erstelle deshalb regelmäßig eine Sicherung.',
    statusLabel: 'Status:',
    granted: 'Dauerhaft gewährt',
    notGranted: 'Nicht gewährt',
    unknown: 'Unbekannt',
    request: 'Persistenten Speicher anfordern',
    requestHint:
      'Viele Browser gewähren das erst, wenn die App zum Home-Bildschirm hinzugefügt oder regelmäßig genutzt wurde. Eine Ablehnung ist kein Fehler.',
    grantedToast: 'Persistenter Speicher wurde gewährt.',
    deniedToast:
      'Der Browser hat persistenten Speicher nicht gewährt. Deine Daten bleiben trotzdem lokal gespeichert.',
    used: 'Belegt',
    available: 'Verfügbar',
    estimateHint:
      'Die Werte sind Schätzungen des Browsers und umfassen auch zwischengespeicherte App-Dateien, nicht nur deine Trainingsdaten.',
  },
  backup: {
    sectionTitle: 'Sicherung',
    last: 'Letzte vollständige Sicherung:',
    never: 'noch nie',
    /** "Erinnerung alle {{days}} Tage." */
    reminder: 'Erinnerung alle {{days}} Tage.',
  },
  database: {
    sectionTitle: 'Datenbank',
    /** "Schemaversion: …" */
    schemaVersion: 'Schemaversion:',
    location: 'Speicherort:',
    offline: 'Offline-Betrieb:',
    offlineSupported: 'unterstützt',
    offlineUnsupported: 'nicht unterstützt',
    startMode: 'Startmodus:',
    startModeInstalled: 'installierte App',
    startModeBrowser: 'im Browser',
    history: 'Schema-Historie',
    /** "Version {{version}}:" */
    version: 'Version {{version}}:',
  },
  goodToKnow: {
    sectionTitle: 'Wichtig zu wissen',
    ownData: 'Jeder Browser und jedes Gerät besitzt einen eigenen Datenbestand.',
    noSync: 'Es gibt keine automatische Synchronisation zwischen Geräten.',
    updateSafe: 'Ein App-Update löscht deine Trainingsdaten nicht.',
    clearingDeletes:
      'Das Löschen der Browser-Websitedaten löscht auch deine Trainingshistorie.',
  },
};

export type Storage = typeof storage;
