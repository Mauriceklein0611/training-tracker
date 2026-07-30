/**
 * Domain labels shown in the UI (#31): tracking types, weight modes, set types.
 *
 * IMPORTANT: these are **display** labels only. The CSV export keeps its own
 * German copies and the AI export keeps its own label maps, so localising here
 * cannot change any format (see docs/FORMAT_COMPATIBILITY.md). Stored values are
 * enum keys and are never translated.
 */
export const domain = {
  equipment: {
    unspecified: 'Nicht festgelegt',
    barbell: 'Langhantel',
    dumbbells: 'Kurzhanteln',
    machine: 'Maschine',
    cable: 'Kabelzug',
    kettlebell: 'Kettlebell',
    bodyweight: 'Körpergewicht',
    band: 'Widerstandsband',
    trx: 'TRX',
    treadmill: 'Laufband',
    ergometer: 'Ergometer/Fahrrad',
    rowing_machine: 'Rudermaschine',
    elliptical: 'Crosstrainer',
    stair_climber: 'Stair Climber',
    pool: 'Pool',
    jump_rope: 'Springseil',
    other: 'Sonstige',
  },
  cardioModality: {
    running: 'Laufen',
    walking: 'Gehen',
    cycling: 'Radfahren',
    rowing: 'Rudern',
    swimming: 'Schwimmen',
    elliptical: 'Crosstrainer',
    stair_climbing: 'Treppensteigen',
    jump_rope: 'Seilspringen',
    other: 'Sonstiges',
  },
  muscleCategory: {
    chest: 'Brust',
    back: 'Rücken',
    shoulders: 'Schultern',
    armsGrip: 'Arme und Griff',
    core: 'Rumpf',
    glutesHips: 'Gesäß und Hüfte',
    legs: 'Beine',
    other: 'Sonstiges',
  },
  muscleGroup: {
    chest: 'Brust',
    'chest-upper': 'Obere Brust',
    'chest-lower': 'Untere Brust',
    lats: 'Latissimus',
    'traps-upper': 'Trapezmuskel oben',
    'traps-mid': 'Trapezmuskel mittig',
    'traps-lower': 'Trapezmuskel unten',
    rhomboids: 'Rhomboiden',
    erectors: 'Rückenstrecker',
    'delt-front': 'Vordere Schulter',
    'delt-side': 'Seitliche Schulter',
    'delt-rear': 'Hintere Schulter',
    'rotator-cuff': 'Rotatorenmanschette',
    biceps: 'Bizeps',
    brachialis: 'Brachialis',
    brachioradialis: 'Brachioradialis',
    triceps: 'Trizeps',
    forearms: 'Unterarme',
    grip: 'Griffkraft',
    'rectus-abdominis': 'Gerader Bauchmuskel',
    obliques: 'Schräge Bauchmuskeln',
    core: 'Tiefe Bauchmuskulatur/Core',
    serratus: 'Serratus',
    'lower-back': 'Unterer Rücken',
    'glute-max': 'Großer Gesäßmuskel',
    'glute-med': 'Mittlerer Gesäßmuskel',
    'glute-min': 'Kleiner Gesäßmuskel',
    'hip-flexors': 'Hüftbeuger',
    adductors: 'Adduktoren',
    abductors: 'Abduktoren',
    quads: 'Quadrizeps',
    hamstrings: 'Beinbeuger/Hamstrings',
    calves: 'Waden',
    tibialis: 'Schienbeinmuskel',
    neck: 'Nacken',
    'full-body': 'Ganzkörper',
  },
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
  weightField: {
    per_hand: 'Gewicht je Hand (kg)',
    total: 'Gewicht gesamt (kg)',
    added_weight: 'Zusatzgewicht (kg)',
    assistance: 'Unterstützung (kg)',
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
