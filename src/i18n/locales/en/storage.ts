import type { Storage } from '@/i18n/locales/de/storage';

export const storage: Storage = {
  title: 'Local storage',
  persistent: {
    sectionTitle: 'Persistent storage',
    subtitle:
      'Prevents the browser from automatically deleting your training data when storage runs low.',
    checking: 'Checking status …',
    unsupported:
      'This browser does not provide the Storage API. The app keeps working normally, but the browser could in theory evict the data when storage runs low. Take regular backups.',
    statusLabel: 'Status:',
    granted: 'Granted permanently',
    notGranted: 'Not granted',
    unknown: 'Unknown',
    request: 'Request persistent storage',
    requestHint:
      'Many browsers only grant this once the app has been added to the home screen or used regularly. A refusal is not an error.',
    grantedToast: 'Persistent storage was granted.',
    deniedToast:
      'The browser did not grant persistent storage. Your data still stays stored locally.',
    used: 'Used',
    available: 'Available',
    estimateHint:
      'The values are browser estimates and also include cached app files, not just your training data.',
  },
  backup: {
    sectionTitle: 'Backup',
    last: 'Last full backup:',
    never: 'never',
    reminder: 'Reminder every {{days}} days.',
  },
  database: {
    sectionTitle: 'Database',
    schemaVersion: 'Schema version:',
    location: 'Location:',
    offline: 'Offline operation:',
    offlineSupported: 'supported',
    offlineUnsupported: 'not supported',
    startMode: 'Start mode:',
    startModeInstalled: 'installed app',
    startModeBrowser: 'in the browser',
    history: 'Schema history',
    version: 'Version {{version}}:',
  },
  goodToKnow: {
    sectionTitle: 'Good to know',
    ownData: 'Every browser and every device has its own separate data.',
    noSync: 'There is no automatic synchronisation between devices.',
    updateSafe: 'An app update does not delete your training data.',
    clearingDeletes: 'Clearing the browser site data also deletes your training history.',
  },
};
