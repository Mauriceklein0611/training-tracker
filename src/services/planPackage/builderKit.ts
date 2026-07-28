import {
  PLAN_BUILDER_KIT_FORMAT,
  PLAN_BUILDER_KIT_VERSION,
  PLAN_PACKAGE_FORMAT,
  PLAN_PACKAGE_SCHEMA_VERSION,
} from '@/constants/formats';
import { MUSCLE_GROUPS } from '@/constants/muscleGroups';
import { allowedWeightModes } from '@/services/exerciseRules';
import { EQUIPMENT_VALUES } from '@/services/equipment';
import { CARDIO_MODALITY_VALUES } from '@/services/cardio';
import type { CardioModality, Equipment, TrackingType } from '@/types';
import { dayKey } from '@/utils/date';

/**
 * The "builder kit" — a self-describing file the user hands to ChatGPT so it can
 * assemble a plan in the exact `training-plan-package` format the app imports.
 *
 * It carries no personal data: only the target contract, the allowed values and
 * the local muscle-group catalog, plus a tiny example. The app never talks to an
 * LLM itself — the user copies the file and the prompt into their own chat.
 */

const TRACKING_TYPES: TrackingType[] = [
  'weight_reps',
  'bodyweight_reps',
  'assisted_bodyweight_reps',
  'reps_only',
  'duration',
  'cardio',
];

export interface PlanBuilderKit {
  format: typeof PLAN_BUILDER_KIT_FORMAT;
  version: typeof PLAN_BUILDER_KIT_VERSION;
  description: string;
  target: {
    format: typeof PLAN_PACKAGE_FORMAT;
    schemaVersion: typeof PLAN_PACKAGE_SCHEMA_VERSION;
  };
  rules: string[];
  allowedValues: {
    trackingType: TrackingType[];
    weightModeByTrackingType: Record<TrackingType, string[]>;
    equipment: Equipment[];
    cardioModality: CardioModality[];
    splitType: string[];
    groupType: string[];
    groupRestMode: string[];
    progressionMethod: string[];
  };
  muscleGroups: string[];
  example: unknown;
}

function buildExample(): unknown {
  return {
    format: PLAN_PACKAGE_FORMAT,
    schemaVersion: PLAN_PACKAGE_SCHEMA_VERSION,
    packageId: 'example-package',
    createdAt: '2026-01-01T00:00:00.000Z',
    source: { kind: 'ai-generated', label: 'ChatGPT' },
    packageName: 'Beispiel: Push/Pull',
    programNotes: '',
    exercises: [
      {
        exerciseKey: 'exercise-1',
        name: 'Bankdrücken',
        primaryMuscleGroup: 'Brust',
        secondaryMuscleGroups: ['Trizeps'],
        equipment: 'Langhantel',
        defaultEquipment: 'barbell',
        trackingType: 'weight_reps',
        weightMode: 'total',
        weightMultiplier: 1,
        defaultRestSeconds: 180,
        notes: '',
      },
      {
        exerciseKey: 'exercise-2',
        name: 'Klimmzug',
        primaryMuscleGroup: 'Latissimus',
        secondaryMuscleGroups: ['Bizeps'],
        equipment: 'Klimmzugstange',
        trackingType: 'bodyweight_reps',
        weightMode: 'none',
        weightMultiplier: 1,
        defaultRestSeconds: 150,
        notes: '',
      },
      {
        exerciseKey: 'exercise-3',
        name: 'Laufen (Intervalle)',
        primaryMuscleGroup: 'Ganzkörper',
        secondaryMuscleGroups: [],
        equipment: 'Laufband',
        defaultEquipment: 'treadmill',
        cardioModality: 'running',
        trackingType: 'cardio',
        weightMode: 'none',
        weightMultiplier: 1,
        defaultRestSeconds: 60,
        notes: '',
      },
    ],
    plans: [
      {
        planKey: 'plan-1',
        name: 'Push/Pull',
        description: '',
        splitType: '2-day',
        days: [
          {
            dayKey: 'day-1',
            name: 'Push',
            description: '',
            position: 0,
            exercises: [
              {
                planExerciseKey: 'pe-1',
                exerciseKey: 'exercise-1',
                order: 0,
                targetSets: 3,
                targetRepMin: 5,
                targetRepMax: 8,
                targetDurationSeconds: null,
                restSeconds: 180,
                notes: '',
                group: null,
              },
            ],
          },
          {
            dayKey: 'day-2',
            name: 'Pull',
            description: '',
            position: 1,
            exercises: [
              {
                planExerciseKey: 'pe-2',
                exerciseKey: 'exercise-2',
                order: 0,
                targetSets: 3,
                targetRepMin: 6,
                targetRepMax: 10,
                targetDurationSeconds: null,
                restSeconds: 150,
                notes: '',
                group: null,
              },
              {
                // Cardio interval position: 4 intervals of ~1000 m at RPE 7,
                // with a 60 s pause between intervals. Reps stay null for cardio.
                planExerciseKey: 'pe-3',
                exerciseKey: 'exercise-3',
                order: 1,
                targetSets: 4,
                targetRepMin: null,
                targetRepMax: null,
                targetDurationSeconds: null,
                targetDistanceMeters: 1000,
                targetRpe: 7,
                restSeconds: 60,
                notes: '',
                group: null,
              },
            ],
          },
        ],
        // Optional schedule (package v3): a repeating cycle Push → Pause → Pull →
        // Pause. Workout entries reference a dayKey of this plan; rest entries
        // carry an optional label. free-rotation would omit "entries" entirely.
        schedule: {
          mode: 'repeating-cycle',
          entries: [
            { type: 'workout', dayKey: 'day-1', position: 0 },
            { type: 'rest', label: 'Pause', position: 1 },
            { type: 'workout', dayKey: 'day-2', position: 2 },
            { type: 'rest', label: 'Pause', position: 3 },
          ],
        },
      },
    ],
  };
}

export function buildPlanBuilderKit(): PlanBuilderKit {
  const weightModeByTrackingType = Object.fromEntries(
    TRACKING_TYPES.map((type) => [type, allowedWeightModes(type)]),
  ) as Record<TrackingType, string[]>;

  return {
    format: PLAN_BUILDER_KIT_FORMAT,
    version: PLAN_BUILDER_KIT_VERSION,
    description:
      'Bauanleitung für einen mehrtägigen Trainingsplan im Format ' +
      `„training-plan-package" (schemaVersion ${PLAN_PACKAGE_SCHEMA_VERSION}, Plan ` +
      'mit Trainingstagen und optionalem Zeitplan). Frage mich zuerst nach Zielen, ' +
      'Erfahrung, Trainingstagen und Ausrüstung. Erzeuge die Datei erst am Ende, ' +
      'wenn ich sie ausdrücklich anfordere.',
    target: {
      format: PLAN_PACKAGE_FORMAT,
      schemaVersion: PLAN_PACKAGE_SCHEMA_VERSION,
    },
    rules: [
      'Antworte während der Planung normal auf Deutsch; erzeuge noch keine Datei.',
      'Erzeuge die Datei erst, wenn ich ausdrücklich darum bitte, und dann als reines JSON ohne Markdown.',
      'Ein Plan besteht aus einem oder mehreren Trainingstagen im Feld „days". Ein Einzeltraining hat genau einen Tag.',
      'Jeder Tag hat einen nichtleeren „name", eine eindeutige „position" (0,1,2, …) und ein Array „exercises" (darf leer sein).',
      'Wähle „splitType" passend zur Tagesanzahl: 1→single, 2→2-day, 3→3-day, 4→4-day, 5→5-day, sonst custom. Die Tagesnamen bestimme ich, nicht der splitType.',
      'Ordne jede Übung genau einem Tag zu. Übungen stehen niemals außerhalb eines Tages.',
      'Verwende ausschließlich die aufgeführten Werte für trackingType, weightMode, groupType, groupRestMode, splitType und progressionMethod.',
      'weightMode muss zum trackingType passen (siehe weightModeByTrackingType).',
      'Zeitbasierte Kraftübungen (Halten, z. B. Plank): trackingType „duration", weightMode „none", targetDurationSeconds gesetzt, targetRepMin/targetRepMax null.',
      'Cardio: trackingType „cardio", weightMode „none", weightMultiplier 1, ein „cardioModality" aus cardioModality und optional ein „defaultEquipment" aus equipment. Cardio ist etwas anderes als „duration" und wird getrennt ausgewertet.',
      'Cardio-Ziele je Planposition: targetSets = Anzahl Intervalle (1 für durchgehendes Cardio), optional targetDurationSeconds, targetDistanceMeters (in Metern) und targetRpe (1–10). Wiederholungen (targetRepMin/targetRepMax) bleiben bei Cardio null.',
      'Strukturierte Ausrüstung ist optional über „defaultEquipment" je Übung. Rate sie nicht aus dem Freitext-„equipment"; lass sie weg, wenn unklar.',
      'Nutze für Muskelgruppen bevorzugt die Bezeichnungen aus „muscleGroups"; unbekannte Bezeichnungen sind erlaubt, aber sparsam.',
      'Verwende nur die Schlüssel exerciseKey, planKey, dayKey, planExerciseKey und groupKey zur Verknüpfung — niemals interne IDs.',
      'exerciseKey, dayKey und planExerciseKey sind jeweils eindeutig; jede Planposition verweist auf einen vorhandenen exerciseKey.',
      'order beginnt bei 0 und ist je Tag eindeutig. targetRepMin darf nicht größer als targetRepMax sein.',
      'Übungen einer Gruppe verwenden denselben groupKey mit identischem type und restMode und stehen am selben Tag direkt hintereinander.',
      'Optionaler Zeitplan je Plan im Feld „schedule" mit „mode" (free-rotation, repeating-cycle oder weekly) und „entries". Ohne schedule wird der Plan als freie Rotation importiert.',
      'schedule.entries: „workout"-Einträge verweisen über „dayKey" auf einen Tag desselben Plans; „rest"-Einträge sind Pausentage mit optionalem „label". Jeder Eintrag hat eine eindeutige „position" (0,1,2, …).',
      'Bei mode „weekly" braucht jeder Eintrag zusätzlich „weekday" (0=Montag … 6=Sonntag), jeder Wochentag höchstens einmal. Bei mode „free-rotation" bleibt „entries" leer (Reihenfolge ergibt sich aus den Tagen).',
      'Pflichtfelder: format, schemaVersion, packageId, createdAt, source, packageName, plans (mit planKey, name, days). Optionale Felder (auch schedule) können entfallen.',
      'Erfinde keine persönlichen Daten. Das Paket enthält nur Pläne und Übungsdefinitionen, keine Trainingshistorie.',
    ],
    allowedValues: {
      trackingType: TRACKING_TYPES,
      weightModeByTrackingType,
      equipment: EQUIPMENT_VALUES,
      cardioModality: CARDIO_MODALITY_VALUES,
      splitType: ['single', '2-day', '3-day', '4-day', '5-day', 'custom'],
      groupType: ['superset', 'circuit'],
      groupRestMode: ['each', 'round'],
      progressionMethod: ['auto', 'weight', 'reps'],
    },
    muscleGroups: MUSCLE_GROUPS.map((group) => group.label),
    example: buildExample(),
  };
}

export function planBuilderKitFileName(date: Date = new Date()): string {
  return `training-plan-builder-kit-${dayKey(date)}.json`;
}

/** Ready-to-paste instruction that accompanies the builder-kit file. */
export const PLAN_BUILDER_PROMPT = `Ich möchte mit dir einen Trainingsplan erstellen. Die beigefügte Datei „training-plan-builder-kit" beschreibt genau das Format, in dem die App den fertigen Plan später importieren kann.

Gehe so vor:
1. Stelle mir zuerst Fragen zu meinen Zielen, meiner Erfahrung, der Anzahl der Trainingstage pro Woche, der Verteilung von Kraft und Cardio, bevorzugten Cardio-Aktivitäten (z. B. Laufen, Radfahren, Rudern), Dauer/Distanz und ob durchgehend oder in Intervallen, der verfügbaren Ausrüstung und eventuellen Einschränkungen (ohne medizinische Beratung).
2. Entwickle den Plan gemeinsam mit mir im Gespräch. Erkläre deine Entscheidungen auf Deutsch und erzeuge noch KEINE Datei.
3. Erst wenn ich ausdrücklich sage „Erstelle jetzt die Datei", gib genau eine Datei „training-plan-package.json" aus: reines JSON ohne Markdown, exakt nach den „rules" und „allowedValues" aus dem Builder-Kit, mit format „training-plan-package" und schemaVersion ${PLAN_PACKAGE_SCHEMA_VERSION}.

Halte dich strikt an die erlaubten Werte und Schlüssel aus dem Builder-Kit und erfinde keine persönlichen Daten.`;
