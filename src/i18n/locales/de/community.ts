/**
 * Community section: voluntary Ko-fi support (#29, #32) and the single Tally
 * feedback entry (#30, #33). German is the source of truth (#31).
 */
export const community = {
  sectionTitle: 'Community',
  externalHint:
    'Diese Einträge öffnen einen externen Dienst in einem neuen Tab. Es werden keine Trainings-, Körper- oder Gerätedaten übertragen.',
  freeNote:
    'Die App bleibt dauerhaft kostenlos. Unterstützung ist freiwillig und keine steuerlich absetzbare Spende.',
  support: {
    label: 'Projekt freiwillig unterstützen',
    description:
      'Bleibt komplett kostenlos — freiwillige Unterstützung über Ko-fi, ohne Konto in der App.',
  },
  feedback: {
    label: 'Feedback geben',
    description: 'Fehler melden, Idee teilen oder Verbesserung vorschlagen.',
  },
  privacyTitle: 'Community-Links: Ko-fi und Feedback-Formular',
  privacyText:
    'Die Einträge im Community-Bereich öffnen externe Dienste erst dann in einem neuen Tab, wenn du sie selbst auswählst (Ko-fi für freiwillige Unterstützung, Tally für Feedback). Beim normalen Start der App werden keine Ko-fi- oder Tally-Ressourcen geladen — keine Iframes, Widgets oder Skripte. Trainingsdaten, Körperdaten, Notizen und Sicherungen werden nicht automatisch übertragen, und es werden keine Parameter mit App-Daten angehängt. Was du freiwillig in das Formular einträgst, wird von Tally verarbeitet; Kontakt-E-Mail und Screenshot sind ausdrücklich freiwillig. Zahlungen über Ko-fi sind freiwillige Unterstützung und keine steuerlich absetzbare Spende.',
  privacyLinkLabel: 'Datenschutzinformationen von Tally',
};

export type Community = typeof community;
