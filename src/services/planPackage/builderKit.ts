import {
  PLAN_BUILDER_KIT_FORMAT,
  PLAN_BUILDER_KIT_VERSION,
  PLAN_PACKAGE_FORMAT,
  PLAN_PACKAGE_SCHEMA_VERSION,
} from '@/constants/formats';
import { MUSCLE_GROUPS } from '@/constants/muscleGroups';
import { allowedWeightModes } from '@/services/exerciseRules';
import type { TrackingType } from '@/types';
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
    packageName: 'Beispiel: Ganzkörper 2x/Woche',
    programNotes: '',
    exercises: [
      {
        exerciseKey: 'exercise-1',
        name: 'Kniebeuge',
        primaryMuscleGroup: 'Quadrizeps',
        secondaryMuscleGroups: ['Gesäß'],
        equipment: 'Langhantel',
        trackingType: 'weight_reps',
        weightMode: 'total',
        weightMultiplier: 1,
        defaultRestSeconds: 180,
        notes: '',
      },
    ],
    plans: [
      {
        planKey: 'plan-1',
        name: 'Tag A',
        description: '',
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
      'Bauanleitung für einen Trainingsplan im Format „training-plan-package". ' +
      'Frage mich zuerst nach Zielen, Erfahrung, Trainingstagen und Ausrüstung. ' +
      'Erzeuge die Datei erst am Ende, wenn ich sie ausdrücklich anfordere.',
    target: {
      format: PLAN_PACKAGE_FORMAT,
      schemaVersion: PLAN_PACKAGE_SCHEMA_VERSION,
    },
    rules: [
      'Antworte während der Planung normal auf Deutsch; erzeuge noch keine Datei.',
      'Erzeuge die Datei erst, wenn ich ausdrücklich darum bitte, und dann als reines JSON ohne Markdown.',
      'Verwende ausschließlich die aufgeführten Werte für trackingType, weightMode, groupType, groupRestMode und progressionMethod.',
      'weightMode muss zum trackingType passen (siehe weightModeByTrackingType).',
      'Nutze für Muskelgruppen bevorzugt die Bezeichnungen aus „muscleGroups"; unbekannte Bezeichnungen sind erlaubt, aber sparsam.',
      'Verwende nur die Schlüssel exerciseKey, planKey, planExerciseKey und groupKey zur Verknüpfung — niemals interne IDs.',
      'Jeder exerciseKey und planExerciseKey ist eindeutig; jede Planposition verweist auf einen vorhandenen exerciseKey.',
      'order beginnt bei 0 und ist je Plan eindeutig. targetRepMin darf nicht größer als targetRepMax sein.',
      'Übungen einer Gruppe verwenden denselben groupKey mit identischem type und restMode und stehen direkt hintereinander.',
      'Erfinde keine persönlichen Daten. Das Paket enthält nur Pläne und Übungsdefinitionen, keine Trainingshistorie.',
    ],
    allowedValues: {
      trackingType: TRACKING_TYPES,
      weightModeByTrackingType,
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
1. Stelle mir zuerst Fragen zu meinen Zielen, meiner Erfahrung, der Anzahl der Trainingstage pro Woche, der verfügbaren Ausrüstung und eventuellen Einschränkungen.
2. Entwickle den Plan gemeinsam mit mir im Gespräch. Erkläre deine Entscheidungen auf Deutsch und erzeuge noch KEINE Datei.
3. Erst wenn ich ausdrücklich sage „Erstelle jetzt die Datei", gib genau eine Datei „training-plan-package.json" aus: reines JSON ohne Markdown, exakt nach den „rules" und „allowedValues" aus dem Builder-Kit, mit format „training-plan-package" und schemaVersion ${PLAN_PACKAGE_SCHEMA_VERSION}.

Halte dich strikt an die erlaubten Werte und Schlüssel aus dem Builder-Kit und erfinde keine persönlichen Daten.`;
