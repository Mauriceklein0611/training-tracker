import type { Community } from '@/i18n/locales/de/community';

export const community: Community = {
  sectionTitle: 'Community',
  externalHint:
    'These entries open an external service in a new tab. No training, body or device data is transferred.',
  freeNote:
    'The app stays free forever. Support is voluntary and not a tax-deductible donation.',
  support: {
    label: 'Support the project',
    description:
      'Stays completely free — voluntary support via Ko-fi, with no in-app account.',
  },
  feedback: {
    label: 'Feedback & requests',
    description: 'Share ideas and feature requests through an external form.',
  },
  bug: {
    label: 'Report a bug',
    description:
      'Report a problem — opens the same external form with a category picker.',
  },
  privacyTitle: 'Community links: Ko-fi and feedback form',
  privacyText:
    'The entries in the Community section only open an external service in a new tab once you choose them yourself (Ko-fi for voluntary support, Tally for feedback). Starting the app normally loads no Ko-fi or Tally resources — no iframes, widgets or scripts. Workout data, body data, notes and backups are never transferred automatically, and no parameters carrying app data are appended. Whatever you voluntarily enter in the form is processed by Tally; contact email and screenshot are explicitly optional. Payments via Ko-fi are voluntary support and not a tax-deductible donation.',
  privacyLinkLabel: 'Tally privacy information',
};
