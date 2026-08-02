import type { GuideResource } from '@/features/guide/model';

export const guide: GuideResource = {
  ui: {
    title: 'Help & guide',
    subtitle: 'Understand and use Exerivo safely — fully available offline',
    search: 'Search the guide',
    searchPlaceholder: 'e.g. backup, RPE or training plan',
    allCategories: 'All',
    noResults: 'No matching articles found.',
    updated: 'Updated',
    related: 'Related articles',
    helpful: 'Was this helpful?',
    helpfulYes: 'Yes',
    helpfulNo: 'No',
    helpfulThanks: 'Thanks for your feedback.',
    note: 'Note',
    warning: 'Important',
  },
  articles: [
    {
      id: 'was-ist-neu',
      title: "What's new?",
      category: 'Start',
      summary: 'The most important changes in Exerivo 1.0.0.',
      keywords: ['new', 'release', 'version', 'Exerivo'],
      content: [
        {
          heading: 'Exerivo 1.0.0',
          paragraphs: [
            'Training Tracker is now Exerivo. The new public website lives at exerivo.com and the installable app at app.exerivo.com.',
          ],
          steps: [
            'New Exerivo branding, app icon and PWA manifest.',
            'Offline guide with search, categories and direct article links.',
            'Onboarding for new users and a dedicated migration notice on the old app address.',
            'Automatic local safety copy before every merge or replace backup import.',
          ],
          warning:
            'Local data does not move between domains automatically. Create a full backup at the old address and then import it on app.exerivo.com.',
        },
      ],
      relatedArticleIds: ['backup-import', 'installation', 'erste-schritte'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'erste-schritte',
      title: 'Getting started',
      category: 'Start',
      summary: 'From first launch to your first recorded workout.',
      keywords: ['start', 'setup', 'first workout'],
      content: [
        {
          heading: 'Ready in a few minutes',
          steps: [
            'Create your first plan under Plans or import a plan package.',
            'Activate the plan and choose the next workout on Home.',
            'Record sets, reps and optionally RIR or RPE during training.',
            'Finish the workout so it appears in History and Analytics.',
          ],
          note: 'You can also start a free strength or cardio workout at any time.',
        },
      ],
      relatedArticleIds: ['trainingsplaene', 'training', 'backup-import'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'installation',
      title: 'Install Exerivo',
      category: 'Start',
      summary: 'Install the PWA on iPhone, Android or desktop.',
      keywords: ['PWA', 'installation', 'iPhone', 'Android', 'desktop'],
      content: [
        {
          heading: 'iPhone and iPad',
          steps: [
            'Open app.exerivo.com in Safari.',
            'Tap Share and then Add to Home Screen.',
            'Confirm the name Exerivo.',
          ],
        },
        {
          heading: 'Android and desktop',
          paragraphs: [
            'Open app.exerivo.com in a supported browser and use Install in the browser menu or address bar.',
          ],
          note: 'After the first complete load, the app is available offline.',
        },
      ],
      relatedArticleIds: ['erste-schritte', 'backup-import', 'datenschutz'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'trainingsplaene',
      title: 'Training plans',
      category: 'Planning',
      summary: 'Manage splits, workout days, schedules and plan packages.',
      keywords: ['plan', 'split', 'workout day', 'import', 'schedule'],
      content: [
        {
          heading: 'Build a plan',
          steps: [
            'Create a plan under Plans and add workout days.',
            'Open a workout day and add exercises with targets and rests.',
            'Choose free rotation or fixed weekdays.',
            'Activate the plan so Home shows the next workout.',
          ],
        },
        {
          heading: 'Share and import',
          paragraphs: [
            'Plan packages only contain content belonging to the plan. Training history, body data and local IDs are not shared.',
          ],
        },
      ],
      relatedArticleIds: ['training', 'deload', 'backup-import'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'training',
      title: 'Record a workout',
      category: 'Training',
      summary: 'Safely record sets, RIR/RPE, rests and active workouts.',
      keywords: ['set', 'RIR', 'RPE', 'rest', 'timer', 'e1RM'],
      content: [
        {
          heading: 'During the workout',
          paragraphs: [
            'Previous values speed up entry. RIR means reps in reserve; RPE is perceived effort. Both are optional.',
          ],
          steps: [
            'Enter weight and reps.',
            'Optionally add effort and set type.',
            'Complete the set and use the rest timer.',
            'Deliberately finish the workout at the end.',
          ],
          warning:
            'A browser or app restart does not discard an active workout. Never clear browser data without a backup.',
        },
      ],
      relatedArticleIds: ['erste-schritte', 'analysen', 'cardio'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'cardio',
      title: 'Track cardio',
      category: 'Training',
      summary: 'Record duration, distance, pace, heart rate and RPE.',
      keywords: ['cardio', 'running', 'cycling', 'pace', 'heart rate'],
      content: [
        {
          heading: 'Start a cardio workout',
          steps: [
            'Start cardio directly from Home or add a cardio exercise to a workout.',
            'Record at least the values required for the activity.',
            'Optionally add distance, heart rate, RPE and notes.',
          ],
          note: 'Cardio is analysed separately from strength volume and estimated 1RM.',
        },
      ],
      relatedArticleIds: ['training', 'analysen'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'analysen',
      title: 'Understand analytics',
      category: 'Progress',
      summary: 'Read volume, e1RM, streaks, muscle groups and cardio.',
      keywords: ['analytics', 'volume', 'e1RM', 'streak', 'body map'],
      content: [
        {
          heading: 'Explainable values',
          paragraphs: [
            'Exerivo calculates metrics solely from your local entries. Estimated 1RM is a comparison value, not a tested maximum.',
            'Filter date ranges, exercises and set types before comparing trends.',
          ],
        },
      ],
      relatedArticleIds: ['training', 'cardio', 'deload'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'deload',
      title: 'Plan a deload',
      category: 'Planning',
      summary: 'Start and finish a controlled recovery phase.',
      keywords: ['deload', 'recovery', 'intensity', 'volume'],
      content: [
        {
          heading: 'Recovery instead of stopping',
          paragraphs: [
            'A deload reduces target values for a limited period. Original plan values remain intact and return afterwards.',
          ],
          warning:
            'Only deliberately edit permanent plan values during a deload. The temporary reduction is separate.',
        },
      ],
      relatedArticleIds: ['trainingsplaene', 'analysen'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'backup-import',
      title: 'Backup, import and domain move',
      category: 'Data',
      summary: 'Back up, validate and move all local data to a new domain.',
      keywords: ['backup', 'export', 'import', 'device move', 'domain move'],
      content: [
        {
          heading: 'Create a full backup',
          steps: [
            'Open More → Data & backup.',
            'Tap Create full backup.',
            'Save the JSON file somewhere safe.',
          ],
        },
        {
          heading: 'Import on app.exerivo.com',
          steps: [
            'Open the new app domain and go to Data & backup.',
            'Choose your Exerivo backup file.',
            'Review the shown records and warnings.',
            'Choose Merge or deliberately confirm Replace.',
          ],
          warning:
            'Browser data is bound to each domain. The old pages.dev address and app.exerivo.com do not share local storage.',
        },
      ],
      relatedArticleIds: ['datenschutz', 'installation', 'erste-schritte'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'datenschutz',
      title: 'Privacy and local data',
      category: 'Data',
      summary: 'What Exerivo stores and when anything leaves your device.',
      keywords: ['privacy', 'IndexedDB', 'local', 'Tally', 'Ko-fi'],
      content: [
        {
          heading: 'Local by default',
          paragraphs: [
            'Training data, body data, plans and settings live in this browser’s IndexedDB. Exerivo has no account, tracking or cloud database.',
            'Only when you share a file yourself or open an external community link does deliberately selected content leave the browser.',
          ],
          warning:
            'Clearing site data can remove your history. Create backups regularly.',
        },
      ],
      relatedArticleIds: ['backup-import', 'installation'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'faq',
      title: 'Frequently asked questions',
      category: 'Start',
      summary: 'Short answers about accounts, offline use, backups and feedback.',
      keywords: ['FAQ', 'questions', 'account', 'offline', 'feedback'],
      content: [
        {
          heading: 'Do I need an account?',
          paragraphs: [
            'No. Exerivo works without registration and stores your data locally in the browser.',
          ],
        },
        {
          heading: 'Does Exerivo work offline?',
          paragraphs: [
            'Yes. After the first complete load, the service worker keeps the app shell and guide available offline.',
          ],
        },
        {
          heading: 'How do I move device or domain?',
          paragraphs: [
            'Create a full backup and import the file at the new destination. Review the import preview before confirming.',
          ],
        },
        {
          heading: 'How do I send feedback?',
          paragraphs: [
            'Under More → Community, the German or English Tally form opens only after your deliberate click.',
          ],
        },
      ],
      relatedArticleIds: ['erste-schritte', 'backup-import', 'datenschutz'],
      updatedAt: '2026-08-02',
    },
  ],
};
