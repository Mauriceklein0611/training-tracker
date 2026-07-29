import type { Common } from '@/i18n/locales/de/common';

export const common: Common = {
  appName: 'Training Tracker',
  nav: {
    label: 'Main navigation',
    home: 'Home',
    plans: 'Plans',
    history: 'History',
    analytics: 'Analytics',
    more: 'More',
  },
  state: {
    loading: 'Loading …',
    empty: 'No entries',
    offline: 'Offline',
    error: 'Something went wrong.',
    noValue: '–',
  },
  action: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    back: 'Back',
    close: 'Close',
    retry: 'Try again',
    confirm: 'Confirm',
    edit: 'Edit',
    share: 'Share',
    later: 'Later',
    dismiss: 'Don’t show again',
  },
  external: {
    opensInNewTab: 'external link, opens in a new tab',
    offlineHint:
      'Unavailable offline — this needs an internet connection. The app itself keeps working fully offline.',
  },
  footer: {
    tagline: 'Training Tracker — private, local training log.',
    privacy: 'No account, no server, no transfer of your data.',
  },
  greeting: {
    morning: 'Good morning',
    day: 'Good afternoon',
    evening: 'Good evening',
  },
  relativeDay: {
    today: 'Today',
    yesterday: 'Yesterday',
  },
  units: {
    setOne: 'set',
    setOther: 'sets',
    sectionOne: 'section',
    sectionOther: 'sections',
    reps: 'reps',
  },
  setSuffix: {
    perHand: '/hand',
    assistance: ' assist.',
    addedWeight: ' added',
  },
};
