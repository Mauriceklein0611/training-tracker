import type { GuideResource } from '@/features/guide/model';

export const guide: GuideResource = {
  ui: {
    title: 'Help & guide',
    subtitle: 'Practical tutorials for planning, training, analytics and data backups',
    search: 'Search the guide',
    searchPlaceholder: 'e.g. backup, RIR, plan rotation or AI analysis',
    allCategories: 'All',
    noResults: 'No matching articles found.',
    updated: 'Updated',
    related: 'What to read next',
    note: 'Tip',
    warning: 'Important',
  },
  articles: [
    {
      id: 'was-ist-neu',
      title: "What's new?",
      category: 'Start',
      summary: 'The key changes in Exerivo 1.0.0 and what you should do now.',
      keywords: ['new', 'release', 'version', 'Exerivo', 'domain move'],
      content: [
        {
          heading: 'Training Tracker is now Exerivo',
          paragraphs: [
            'The public website is available at exerivo.com. The installable training app itself lives at app.exerivo.com. Every new entry point now opens that address directly.',
            'Your training data still stays locally in your browser. The new name and app icon do not automatically transfer or delete data.',
          ],
        },
        {
          heading: 'New in version 1.0.0',
          steps: [
            'New Exerivo branding, app icon and PWA manifest.',
            'A detailed offline guide with search, categories and direct article links.',
            'One-time onboarding for new users and a time-limited backup path from the old app.',
            'An automatic local safety copy before every merge or replace backup import.',
          ],
          warning:
            'Local data does not move between domains automatically. If you used the old app, create a full backup there and import it at app.exerivo.com.',
        },
      ],
      relatedArticleIds: ['backup-import', 'installation', 'erste-schritte'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'erste-schritte',
      title: 'Getting started',
      category: 'Start',
      summary: 'A complete tour from first launch to your first analysed workout.',
      keywords: ['start', 'setup', 'first workout', 'tutorial', 'Home'],
      content: [
        {
          heading: '1. Choose the basic settings',
          steps: [
            'Open More → Settings.',
            'Choose English, German or automatic device language.',
            'Choose whether to record effort as RIR, RPE or not at all.',
            'Check the default rest, rest signal and keep-screen-awake options.',
          ],
          note: 'You can change all settings later without affecting existing workout data.',
        },
        {
          heading: '2. Choose a plan or a free workout',
          paragraphs: [
            'A training plan works best for recurring workouts with defined exercises and targets. Free training is useful for spontaneous sessions without advance planning.',
          ],
          steps: [
            'For a plan: open Plans, create a plan and add at least one workout day.',
            'For a spontaneous session: choose Free workout or Cardio on Home.',
          ],
        },
        {
          heading: '3. Record your first workout',
          steps: [
            'Start the suggested workout on Home or begin a free workout.',
            'Enter weight, repetitions and optionally RIR/RPE for each set.',
            'Complete the set; only completed sets count in History and Analytics.',
            'Finish the whole workout and check the summary.',
          ],
        },
        {
          heading: '4. Review progress and create a backup',
          steps: [
            'Open History to review individual workouts and your calendar.',
            'Open Analytics and wait for several comparable workouts before judging trends.',
            'Create your first full backup under More → Data & backup.',
          ],
          warning:
            'Without a backup, cleared browser data or a device change can make your local history inaccessible.',
        },
      ],
      relatedArticleIds: ['trainingsplaene', 'training', 'backup-import'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'installation',
      title: 'Install Exerivo',
      category: 'Start',
      summary:
        'Install the PWA on iPhone, Android or desktop and use it reliably offline.',
      keywords: ['PWA', 'installation', 'iPhone', 'Android', 'desktop', 'offline'],
      content: [
        {
          heading: 'iPhone and iPad',
          steps: [
            'Open app.exerivo.com directly in Safari.',
            'Tap Share in Safari.',
            'Choose Add to Home Screen and confirm the name Exerivo.',
            'Launch Exerivo from the new Home Screen icon.',
          ],
          note: 'Other iOS browsers may not expose the full installation option. Use Safari for installation.',
        },
        {
          heading: 'Android',
          steps: [
            'Open app.exerivo.com in Chrome or another PWA-capable browser.',
            'Use Install app or Add to Home screen in the browser menu.',
            'Confirm the installation and then launch Exerivo from its app icon.',
          ],
        },
        {
          heading: 'Windows, macOS and Linux',
          paragraphs: [
            'In Chrome or Edge, installation usually appears in the address bar or browser menu. The installed PWA opens in its own window but still uses the local storage of that browser profile.',
          ],
        },
        {
          heading: 'Test offline mode',
          steps: [
            'Open Exerivo once with an internet connection and let it load fully.',
            'Wait until the Home screen is visible.',
            'Open the app again later while offline. The interface and guide should be available.',
          ],
          warning:
            'Private browsing and clearing site data are not suitable for permanent training records.',
        },
      ],
      relatedArticleIds: ['erste-schritte', 'backup-import', 'datenschutz'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'trainingsplaene',
      title: 'Training plans step by step',
      category: 'Planning',
      summary:
        'Set up plans, workout days, targets, rotation, weekly schedules and plan packages.',
      keywords: [
        'plan',
        'split',
        'workout day',
        'import',
        'schedule',
        'rotation',
        'week',
      ],
      content: [
        {
          heading: 'What belongs in a training plan?',
          paragraphs: [
            'A plan is the overall structure, such as Full body, Push/Pull/Legs or Marathon preparation. It contains workout days such as Push, Pull or Intervals. Each workout day contains exercises with target sets, rep ranges, duration or distance and planned rests.',
            'Only an active plan supplies the next suggested workout on Home. Other plans stay saved and can be activated again later.',
          ],
        },
        {
          heading: 'Create a new plan',
          steps: [
            'Open Plans and tap New plan.',
            'Enter a clear name and optionally a goal or description.',
            'Save the plan and open its overview.',
            'Add the first workout day, such as Full body A.',
            'Only add more days when their exercises or targets actually differ.',
          ],
          note: 'Start with a simple plan. Exercises, order and targets can be edited later.',
        },
        {
          heading: 'Build a workout day',
          steps: [
            'Open the workout day and choose Edit.',
            'Add exercises from your library or create a custom exercise.',
            'Set the number of working sets and suitable targets for each exercise.',
            'Add a rep range, RIR/RPE target, rest or cardio target only where it is useful.',
            'Arrange exercises in the order in which you normally perform them.',
            'Save and review the workout-day summary.',
          ],
          warning:
            'Plan targets are intentions, not completed performance. Actual values are created only in a finished workout.',
        },
        {
          heading: 'Free rotation or fixed weekdays',
          paragraphs: [
            'With free rotation, Exerivo suggests the next workout day in sequence after each completed session. This suits schedules that change from week to week.',
            'With fixed weekdays, you assign workouts to specific days. This suits a stable weekly routine. You can still deliberately choose an extra or missed session.',
          ],
          steps: [
            'Open Schedule in the plan overview.',
            'Choose rotation or fixed weekdays.',
            'For fixed days, assign a workout day to each desired weekday.',
            'Check which workout Home shows next.',
          ],
        },
        {
          heading: 'Activate, switch or pause a plan',
          paragraphs: [
            'Activating a plan makes it the basis for Home and the next suggested workout. Switching does not delete old plans or training history.',
          ],
          steps: [
            'Open the plan you want to use.',
            'Tap Activate and confirm the selection.',
            'Check the cycle week, next workout and schedule if applicable.',
          ],
        },
        {
          heading: 'Share or import a plan',
          paragraphs: [
            'A plan package contains the selected plan structure and the exercises it needs. It does not contain completed workout history, body data or app settings.',
          ],
          steps: [
            'Export a plan package from the plan overview.',
            'Share only this plan-package file when someone should receive your plan.',
            'On import, Exerivo first shows a preview and possible conflicts.',
            'Confirm only after the name, workout days and exercises look correct.',
          ],
        },
      ],
      relatedArticleIds: ['uebungen-und-equipment', 'training', 'deload'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'uebungen-und-equipment',
      title: 'Set up exercises and equipment',
      category: 'Planning',
      summary:
        'Use custom exercises, tracking types, weight conventions, alternatives and equipment profiles correctly.',
      keywords: [
        'exercise',
        'equipment',
        'weight',
        'dumbbell',
        'alternative',
        'muscle group',
      ],
      content: [
        {
          heading: 'Choose the right tracking type',
          paragraphs: [
            'Weighted exercises record load and repetitions. Bodyweight or reps-only exercises do not necessarily need a kilogram value. Timed exercises use duration; cardio can also use distance, pace or heart rate.',
          ],
          warning:
            'A wrong tracking type distorts later comparisons. Change it only when the exercise should genuinely be recorded differently.',
        },
        {
          heading: 'Create a custom exercise',
          steps: [
            'Open More → Exercises and choose New exercise.',
            'Enter a distinct name and choose primary and secondary muscle groups.',
            'Set the tracking type, default equipment and default rest.',
            'Optionally add weight increments, available weights, technique cues and alternatives.',
            'Save the exercise and add it to a plan or free workout.',
          ],
        },
        {
          heading: 'Dumbbells and the weight multiplier',
          paragraphs: [
            'If you enter dumbbell weight per hand, a multiplier of 2 can represent the total moved load. If you already enter the combined weight, keep the multiplier at 1.',
          ],
          note: 'Keep the same convention for an exercise over time so volume and trends remain comparable.',
        },
        {
          heading: 'Use equipment profiles',
          steps: [
            'Open More → Equipment and create a profile such as Gym, Home or Hotel.',
            'Select the equipment available at that location.',
            'Activate the relevant profile.',
            'Use the available-equipment filter in exercise pickers.',
          ],
          note: 'A profile filters unsuitable exercises in pickers; it does not delete existing plans or exercises.',
        },
      ],
      relatedArticleIds: ['trainingsplaene', 'training', 'analysen'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'training',
      title: 'Record a complete workout',
      category: 'Training',
      summary:
        'Control an active workout, understand set types and produce clean comparison data.',
      keywords: ['set', 'RIR', 'RPE', 'rest', 'timer', 'warm-up', 'drop set'],
      content: [
        {
          heading: 'Start and prepare the workout',
          steps: [
            'Start the suggested plan workout on Home or choose Free workout.',
            'Review exercises, targets and order before completing the first set.',
            'Add or replace an exercise if needed, or change equipment only for this workout.',
            'Use the optional check-in when you want to record energy, sleep or limitations for your own context.',
          ],
        },
        {
          heading: 'Record a strength set',
          steps: [
            'Enter the load actually used and the clean repetitions completed.',
            'Choose warm-up, working, drop or failure set where appropriate.',
            'Add RIR or RPE only when you can make a useful effort estimate.',
            'Tap Complete set. Only then is it saved and the rest timer starts.',
          ],
          note: 'Previous values are only an entry aid. Do not copy them blindly after changing execution or equipment.',
        },
        {
          heading: 'RIR and RPE in plain language',
          paragraphs: [
            'RIR means reps in reserve: RIR 2 means roughly two more clean repetitions were possible. RPE describes perceived effort on a scale up to 10; RPE 8 is approximately RIR 2. Both are personal estimates, not measurements.',
          ],
        },
        {
          heading: 'Rests and interrupted workouts',
          paragraphs: [
            'The timer uses an absolute end time, so the rest remains meaningful after locking the screen or briefly switching apps. An active workout is stored locally and can continue after a restart.',
          ],
          warning:
            'Clearing site data during an active workout also removes its local in-progress state.',
        },
        {
          heading: 'Finish and correct a workout',
          steps: [
            'Check that every set you actually performed is completed.',
            'Deliberately finish the workout and optionally add the check-out.',
            'Review the summary and later open the workout in History if needed.',
            'Correct an incorrect completed set in History instead of creating a duplicate workout.',
          ],
        },
      ],
      relatedArticleIds: ['trainingsplaene', 'analysen', 'cardio'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'cardio',
      title: 'Track cardio meaningfully',
      category: 'Training',
      summary:
        'Record duration, distance, pace, speed, heart rate and intervals correctly.',
      keywords: ['cardio', 'running', 'cycling', 'pace', 'heart rate', 'interval'],
      content: [
        {
          heading: 'Start a cardio workout',
          steps: [
            'Start free cardio on Home or open a cardio workout day from your plan.',
            'Choose the activity and device so Exerivo uses suitable fields and units.',
            'Record at least duration; add distance when pace or speed should be calculated.',
            'Optionally enter average heart rate, RPE and a note.',
          ],
        },
        {
          heading: 'Understand pace and speed',
          paragraphs: [
            'For running, pace is usually minutes per kilometre. For cycling, kilometres per hour are often easier to read. Exerivo can calculate either only when duration and distance are both available and plausible.',
          ],
          note: 'A missing value stays empty; Exerivo does not invent distance or heart rate.',
        },
        {
          heading: 'Record intervals',
          paragraphs: [
            'For repeated efforts, complete individual cardio segments with duration or distance and use planned rests. This keeps work and recovery separately understandable.',
          ],
          warning:
            'Cardio metrics are analysed separately from strength volume and estimated 1RM.',
        },
      ],
      relatedArticleIds: ['training', 'analysen', 'trainingsplaene'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'analysen',
      title: 'Read analytics correctly',
      category: 'Progress',
      summary:
        'Use volume, e1RM, frequency, muscle groups and cardio trends without misreading them.',
      keywords: [
        'analytics',
        'volume',
        'e1RM',
        'streak',
        'body map',
        'comparison',
        'trend',
      ],
      content: [
        {
          heading: 'Filter first, compare second',
          steps: [
            'Choose a period containing enough comparable workouts.',
            'Filter by plan, workout day, exercise or set type where needed.',
            'Compare like-for-like exercises using the same weight convention.',
            'Consider breaks, illness, deloads and changed equipment.',
          ],
        },
        {
          heading: 'Training volume',
          paragraphs: [
            'Volume is the sum of weight × repetitions for suitable strength sets. More volume can result from more sets, more reps or more weight and is not a quality score on its own.',
          ],
          warning:
            'Bodyweight, timed and other exercises without a meaningful kilogram load never receive invented kg volume.',
        },
        {
          heading: 'Estimated 1RM (e1RM)',
          paragraphs: [
            'e1RM estimates a theoretical one-repetition performance from weight and reps. It is more useful for trends within the same exercise than for comparisons across exercises or people.',
          ],
          note: 'Very high-repetition sets are less informative. e1RM is not a tested maximum.',
        },
        {
          heading: 'Muscle groups and training frequency',
          paragraphs: [
            'The muscle view uses the primary and secondary muscles assigned to your exercises. Incomplete exercise assignments therefore create incomplete maps. Frequency and streaks show consistency, but do not automatically judge workout quality or recovery.',
          ],
        },
        {
          heading: 'What a useful trend looks like',
          paragraphs: [
            'Look for a repeatable development across several weeks: more reps at the same weight, more weight in the same rep range, better cardio pace at similar effort or more consistent training frequency.',
            'One poor day is not automatically regression. Use notes and check-ins to understand outliers.',
          ],
        },
      ],
      relatedArticleIds: ['training', 'cardio', 'ki-analysen'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'ki-analysen',
      title: 'Use AI analysis safely',
      category: 'Progress',
      summary:
        'Deliberately export data, analyse it externally and review response files before applying anything.',
      keywords: [
        'AI',
        'analysis',
        'export',
        'response file',
        'ChatGPT',
        'proposal',
        'import',
      ],
      content: [
        {
          heading: 'How the round trip works',
          paragraphs: [
            'Exerivo does not make an AI request itself. It creates a structured export file locally. You decide whether and where to upload that file. Exerivo can then validate and display a compatible response file.',
          ],
          steps: [
            'Open More → Data & backup and create an export for AI analysis.',
            'Deliberately select the period and optional content.',
            'Upload the file to an external AI service and request a response in the specified Exerivo format.',
            'Save the response as a JSON file.',
            'Open More → AI analyses and import or paste the response.',
          ],
        },
        {
          heading: 'What happens during import',
          paragraphs: [
            'Feedback is initially displayed as text only. Proposed plan changes appear individually with their previous and new values. Selecting a file never applies changes without review.',
          ],
          steps: [
            'Read the summary, observations and recommendations.',
            'Review every proposed change and any conflict.',
            'Select only proposals you genuinely want to apply.',
            'Confirm deliberately. A limited undo is offered when restore points are available.',
          ],
        },
        {
          heading: 'Duplicate or outdated responses',
          paragraphs: [
            'Exerivo recognises known export references and duplicate response files. If your plan changed after export, mismatched original values are marked as conflicts instead of silently overwriting current data.',
          ],
        },
        {
          heading: 'Privacy',
          warning:
            'The file leaves your device only when you share it yourself. Before uploading, check which periods, notes and optional body data are included. The external AI service processes the file under its own privacy rules.',
        },
      ],
      relatedArticleIds: ['analysen', 'backup-import', 'datenschutz'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'deload',
      title: 'Plan a deload',
      category: 'Planning',
      summary: 'Start, understand and finish a time-limited recovery phase.',
      keywords: ['deload', 'recovery', 'intensity', 'volume', 'reduction'],
      content: [
        {
          heading: 'What a deload changes in Exerivo',
          paragraphs: [
            'A deload reduces displayed targets for a limited period. Original plan values remain as the baseline and return afterwards. Completed workouts keep the values you actually recorded.',
          ],
        },
        {
          heading: 'Set up a deload',
          steps: [
            'Open the active plan and choose the deload function.',
            'Choose the period and desired reduction.',
            'Review reduced targets before the next workout.',
            'Continue to record the values actually completed.',
          ],
        },
        {
          heading: 'Finish a deload',
          paragraphs: [
            'When the period ends, the temporary reduction stops and normal targets return. Analytics and comparisons retain the recovery phase as context.',
          ],
          warning:
            'Edit permanent plan values during a deload only deliberately. A normal plan edit is separate from the temporary reduction.',
        },
      ],
      relatedArticleIds: ['trainingsplaene', 'analysen', 'training'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'backup-import',
      title: 'Backup, import and domain move',
      category: 'Data',
      summary:
        'Back up all local data, review a preview and safely move to a new domain or device.',
      keywords: [
        'backup',
        'export',
        'import',
        'device move',
        'domain move',
        'merge',
        'replace',
      ],
      content: [
        {
          heading: 'Why a backup is necessary',
          paragraphs: [
            'Exerivo has no account and no cloud database. Your data belongs to the current browser, device and domain. A full backup is therefore the only reliable route for recovery, a device move or a domain move.',
          ],
        },
        {
          heading: 'Create a full backup',
          steps: [
            'Open More → Data & backup.',
            'Tap Create full backup.',
            'Wait for the JSON file to download or for the save prompt.',
            'Store it outside the browser download folder, such as in a cloud drive you control or on external storage.',
            'Keep at least the latest known-good backup.',
          ],
          note: 'Create a fresh backup before major imports, switching browsers or clearing site data.',
        },
        {
          heading: 'Move from the old app to app.exerivo.com',
          steps: [
            'Open the old pages.dev app and go to More → Data & backup.',
            'Create and save a full backup.',
            'Open app.exerivo.com and go to More → Data & backup there.',
            'Select the backup file you just created.',
            'Review the preview and confirm the intended import mode.',
            'Check plans, history and settings on the new domain.',
          ],
          warning:
            'The old and new domains do not share local storage. Merely opening the new address does not transfer data.',
        },
        {
          heading: 'Merge or replace?',
          paragraphs: [
            'Merge adds records and is usually appropriate when the destination already contains new data. Replace resets the destination to the backup contents and is appropriate only when the backup should deliberately become the full destination state.',
            'Before either mode, Exerivo creates a local safety copy of the previous destination state. You should still read the complete preview and warnings.',
          ],
        },
        {
          heading: 'Check after import',
          steps: [
            'Compare the number of plans and recent workouts.',
            'Open at least one plan and one History entry.',
            'Check language, rests and other settings.',
            'Create a fresh full backup on the new domain.',
          ],
        },
      ],
      relatedArticleIds: ['datenschutz', 'installation', 'erste-schritte'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'datenschutz',
      title: 'Privacy and local data',
      category: 'Data',
      summary:
        'Understand where Exerivo stores data and when information leaves your device.',
      keywords: ['privacy', 'IndexedDB', 'local', 'Tally', 'Ko-fi', 'AI'],
      content: [
        {
          heading: 'What is stored locally',
          paragraphs: [
            'Exercises, plans, workouts, sets, rests, notes, body data, settings and imported AI analyses live in this domain’s local browser database.',
            'Exerivo has no user account, advertising integration or usage tracking. The app cannot remotely read your local content.',
          ],
        },
        {
          heading: 'When data leaves the device',
          paragraphs: [
            'Only a file you deliberately export and then share leaves the browser. The same applies to text or screenshots you enter into Tally, Ko-fi or an external AI service yourself.',
          ],
          note: 'Normal Exerivo startup does not load embedded Tally or Ko-fi widgets.',
        },
        {
          heading: 'What local storage means',
          steps: [
            'Another browser on the same device does not automatically see the data.',
            'Another domain has separate local storage.',
            'Private windows may remove data when they close.',
            'Clearing site data can remove the entire history.',
          ],
        },
        {
          heading: 'Your protection routine',
          steps: [
            'Use the canonical address app.exerivo.com.',
            'Create full backups regularly.',
            'Check exports for notes and optional body data before sharing.',
            'Keep backup files in a location you control.',
          ],
        },
      ],
      relatedArticleIds: ['backup-import', 'ki-analysen', 'installation'],
      updatedAt: '2026-08-02',
    },
    {
      id: 'faq',
      title: 'Frequently asked questions and troubleshooting',
      category: 'Start',
      summary:
        'Quick answers about accounts, offline use, missing data, installation and feedback.',
      keywords: [
        'FAQ',
        'questions',
        'account',
        'offline',
        'feedback',
        'error',
        'missing data',
      ],
      content: [
        {
          heading: 'Do I need an account?',
          paragraphs: [
            'No. Exerivo works without registration and stores your data locally in the browser.',
          ],
        },
        {
          heading: 'Why can I not see my data on another device or browser?',
          paragraphs: [
            'Local storage is not synchronised automatically. Create a full backup on the previous device and import it in the desired browser or on the new device.',
          ],
        },
        {
          heading: 'Does Exerivo work offline?',
          paragraphs: [
            'Yes. First open and fully load the app online. The interface and guide are then available offline. External links and a first-time update still require internet access.',
          ],
        },
        {
          heading: 'Why is a metric missing in Analytics?',
          paragraphs: [
            'Exerivo displays only calculable values. Pace needs duration and distance, e1RM needs a suitable weighted exercise, and muscle maps need assigned muscle groups. Missing values are not estimated.',
          ],
        },
        {
          heading: 'The app reports a new version. Will I lose data?',
          paragraphs: [
            'A normal app update keeps the local database. You should still create regular backups and avoid clearing browser site data at the same time.',
          ],
        },
        {
          heading: 'How do I send real feedback or report a bug?',
          paragraphs: [
            'Open More → Community and choose the German or English Tally form. The external link opens only after your click; you decide which description, contact address or screenshots to submit.',
          ],
        },
      ],
      relatedArticleIds: ['erste-schritte', 'backup-import', 'analysen'],
      updatedAt: '2026-08-02',
    },
  ],
};
