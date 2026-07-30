/**
 * Domain labels shown in the UI (#31): tracking types, weight modes, set types.
 *
 * IMPORTANT: these are **display** labels only. The CSV export keeps its own
 * German copies and the AI export keeps its own label maps, so localising here
 * cannot change any format (see docs/FORMAT_COMPATIBILITY.md). Stored values are
 * enum keys and are never translated.
 */
export const domain = {
  trackingType: {
    weight_reps: 'Gewicht + Wiederholungen',
    bodyweight_reps: 'Körpergewicht',
    assisted_bodyweight_reps: 'Unterstützt',
    reps_only: 'Nur Wiederholungen',
    duration: 'Zeit',
    cardio: 'Cardio',
  },
  trackingTypeHelp: {
    weight_reps:
      'Externes Gewicht und Wiederholungen, z. B. Bankdrücken oder Kurzhantelcurls.',
    bodyweight_reps:
      'Eigengewicht mit optionalem Zusatzgewicht, z. B. Klimmzüge oder Dips.',
    assisted_bodyweight_reps:
      'Unterstützte Eigengewichtsübung, z. B. Klimmzüge an der Maschine oder mit Band.',
    reps_only: 'Nur Wiederholungen ohne sinnvolle Last, z. B. TRX-Rudern oder Mobilität.',
    duration: 'Zeit statt Wiederholungen, z. B. Plank oder Dead Hang.',
    cardio:
      'Ausdauertraining mit Dauer und/oder Distanz, z. B. Laufen, Radfahren oder Rudern. Wird getrennt von Kraft ausgewertet.',
  },
  weightMode: {
    per_hand: 'Je Hand',
    total: 'Gesamt',
    added_weight: 'Zusatzgewicht',
    assistance: 'Unterstützung',
    none: 'Kein Gewicht',
  },
  weightModeHelp: {
    per_hand:
      'Der eingetragene Wert gilt pro Hantel. Der Multiplikator bestimmt die Gesamtlast.',
    total:
      'Der eingetragene Wert ist bereits die Gesamtlast, z. B. Langhantel inklusive Stange.',
    added_weight: 'Zusätzliches Gewicht zum Körpergewicht, z. B. Gewichtsgürtel.',
    assistance:
      'Unterstützung, die die Last verringert, z. B. Gegengewicht an der Maschine.',
    none: 'Für diese Übung wird kein Gewicht erfasst.',
  },
  setType: {
    warmup: 'Aufwärmsatz',
    working: 'Arbeitssatz',
    drop: 'Dropsatz',
    failure: 'Bis Versagen',
  },
  /** One-letter badges in the dense set list. */
  setTypeShort: {
    warmup: 'A',
    working: 'W',
    drop: 'D',
    failure: 'V',
  },
};

export type Domain = typeof domain;
