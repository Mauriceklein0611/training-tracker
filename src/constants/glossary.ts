/**
 * Plain-language explanations of the technical terms the app uses (Phase G6).
 *
 * Central and data-only, so the same wording backs both the inline info hints
 * next to a term and the glossary page. Each entry keeps four parts: the term,
 * a short definition, a concrete example and, where it matters, a caveat — so a
 * beginner is never left guessing and an estimate is never mistaken for a
 * measurement.
 */
export interface GlossaryEntry {
  /** Stable key used by an inline {@link InfoHint term="…"}. */
  key: string;
  term: string;
  definition: string;
  example: string;
  /** Optional limitation — e.g. "an estimate, not a measurement". */
  caveat?: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    key: 'rpe',
    term: 'RPE',
    definition:
      'Rate of Perceived Exertion — wie anstrengend sich ein Satz angefühlt hat, auf einer Skala von 1 bis 10.',
    example: 'RPE 8 heißt: hart, aber es wären noch etwa 2 Wiederholungen gegangen.',
    caveat:
      'Subjektiv und persönlich — kein Messwert und nicht zwischen Personen vergleichbar.',
  },
  {
    key: 'rir',
    term: 'RIR',
    definition:
      'Reps in Reserve — wie viele Wiederholungen am Satzende noch möglich gewesen wären.',
    example:
      'RIR 2 heißt: nach dem letzten Rep wären noch 2 saubere Wiederholungen gegangen.',
    caveat:
      'Eine Einschätzung. RPE und RIR lassen sich nur näherungsweise ineinander umrechnen.',
  },
  {
    key: '1rm',
    term: '1RM',
    definition:
      'One-Rep Max — das höchste Gewicht, das du für genau eine Wiederholung bewegen kannst.',
    example: 'Wenn 100 kg genau einmal gehen, ist dein 1RM 100 kg.',
    caveat:
      'Ein echtes 1RM wird tatsächlich getestet — die App misst es nicht, sondern schätzt es (siehe e1RM).',
  },
  {
    key: 'e1rm',
    term: 'e1RM',
    definition:
      'Geschätztes 1RM — aus Gewicht und Wiederholungen berechnet (Epley-Formel), ohne dass du ein Maximum testen musst.',
    example: '20 kg × 12 ergibt ein e1RM von etwa 28 kg (20 × (1 + 12 / 30)).',
    caveat:
      'Nur eine Schätzung, am zuverlässigsten bei 1–12 Wiederholungen und Übungen mit externem Gewicht.',
  },
  {
    key: 'volume',
    term: 'Trainingsvolumen',
    definition:
      'Die geleistete Gesamtlast einer Übung oder Einheit: Gewicht × Wiederholungen, über alle gewerteten Sätze summiert.',
    example: '3 Sätze mit 50 kg × 10 ergeben 1.500 kg Volumen.',
    caveat:
      'Nur für Übungen mit sinnvoller Kilogramm-Last; Körpergewichts- oder Zeitübungen liefern kein kg-Volumen.',
  },
  {
    key: 'workingSet',
    term: 'Arbeitssatz',
    definition:
      'Ein echter Belastungssatz, der zum Trainingsziel zählt — im Gegensatz zu einem Aufwärmsatz.',
    example: 'Nach 2 Aufwärmsätzen zählen die 3 schweren Sätze als Arbeitssätze.',
  },
  {
    key: 'intensity',
    term: 'Intensität',
    definition:
      'Wie schwer das Gewicht relativ zu deinem Maximum ist — je näher am 1RM, desto höher die Intensität.',
    example:
      '5 Wiederholungen mit 90 % des 1RM sind hohe Intensität; 15 leichte Wiederholungen sind niedrige Intensität.',
  },
  {
    key: 'deload',
    term: 'Deload',
    definition:
      'Eine bewusst leichtere Woche mit reduzierten Zielwerten, um Erholung zu ermöglichen.',
    example: 'In der Deload-Woche werden Gewicht oder Sätze planmäßig gesenkt.',
    caveat:
      'Eine geplante Reduktion — sie wird in Analyse und Vergleich markiert und nicht als Rückschritt gewertet.',
  },
  {
    key: 'pace',
    term: 'Pace',
    definition:
      'Das Tempo im Cardio, meist als Zeit pro Strecke (z. B. min/km) oder als Geschwindigkeit (km/h).',
    example: '5 km in 25 Minuten ergeben eine Pace von 5:00 min/km.',
    caveat: 'Nur berechenbar, wenn sowohl Dauer als auch Distanz erfasst sind.',
  },
  {
    key: 'restAdherence',
    term: 'Pausentreue',
    definition: 'Wie gut die tatsächlichen Satzpausen zur geplanten Pausenzeit passen.',
    example: 'Zielpause 90 s, tatsächlich im Schnitt 95 s — die Pausentreue ist hoch.',
  },
  {
    key: 'muscleGroups',
    term: 'Primäre & sekundäre Muskelgruppe',
    definition:
      'Primär sind die Hauptmuskeln einer Übung, sekundär die unterstützend beteiligten.',
    example:
      'Beim Bankdrücken ist die Brust primär, Trizeps und vordere Schulter sind sekundär.',
  },
];

export const GLOSSARY_BY_KEY: Record<string, GlossaryEntry> = Object.fromEntries(
  GLOSSARY.map((entry) => [entry.key, entry]),
);
