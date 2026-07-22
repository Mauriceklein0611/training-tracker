import { useEffect, useId, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { NumberField, SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { createExercise, updateExercise } from '@/db/repositories/exercises';
import { validateExerciseForm, parseNumberInput } from '@/services/validation';
import type { Exercise, ProgressionMethod, TrackingType, WeightMode } from '@/types';
import {
  EQUIPMENT_SUGGESTIONS,
  MUSCLE_GROUP_SUGGESTIONS,
  TRACKING_TYPE_HELP,
  TRACKING_TYPE_LABELS,
  WEIGHT_MODE_HELP,
  WEIGHT_MODE_LABELS,
} from '@/utils/format';
import { useToast } from '@/hooks/useToast';

/** Weight convention that makes sense for a freshly chosen tracking type. */
function defaultWeightMode(trackingType: TrackingType): WeightMode {
  switch (trackingType) {
    case 'weight_reps':
      return 'total';
    case 'bodyweight_reps':
      return 'added_weight';
    case 'assisted_bodyweight_reps':
      return 'assistance';
    case 'reps_only':
    case 'duration':
      return 'none';
  }
}

/** Weight conventions that are valid for a tracking type. */
function allowedWeightModes(trackingType: TrackingType): WeightMode[] {
  switch (trackingType) {
    case 'weight_reps':
      return ['total', 'per_hand'];
    case 'bodyweight_reps':
      return ['added_weight', 'none'];
    case 'assisted_bodyweight_reps':
      return ['assistance', 'none'];
    case 'reps_only':
    case 'duration':
      return ['none'];
  }
}

interface FormState {
  name: string;
  primaryMuscleGroup: string;
  secondaryMuscleGroups: string;
  equipment: string;
  trackingType: TrackingType;
  weightMode: WeightMode;
  weightMultiplier: string;
  defaultRestSeconds: string;
  weightIncrementKg: string;
  availableWeightsKg: string;
  progressionMethod: ProgressionMethod;
  targetRir: string;
  techniqueCues: string;
  alternativeExerciseIds: string[];
  notes: string;
}

/** Splits the cues textarea (one per line) into a clean, bounded array. */
function parseCues(raw: string): string[] | undefined {
  const cues = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
  return cues.length > 0 ? cues : undefined;
}

/** Parses an optional numeric field; out-of-range or empty yields undefined. */
function optionalNumber(raw: string, range: { min: number; max: number }): number | undefined {
  const parsed = parseNumberInput(raw);
  if (parsed == null || Number.isNaN(parsed)) return undefined;
  if (parsed < range.min || parsed > range.max) return undefined;
  return parsed;
}

/** "10, 12.5, 15" → [10, 12.5, 15]; unusable entries are dropped. */
function parseWeightList(raw: string): number[] | undefined {
  const values = raw
    .split(',')
    .map((part) => parseNumberInput(part))
    .filter((value): value is number => value != null && Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  // Deduplicate, so a typo cannot produce two identical rack entries.
  const unique = [...new Set(values)];
  return unique.length > 0 ? unique : undefined;
}

function toFormState(exercise?: Exercise, defaultRest = 120): FormState {
  return {
    name: exercise?.name ?? '',
    primaryMuscleGroup: exercise?.primaryMuscleGroup ?? '',
    secondaryMuscleGroups: exercise?.secondaryMuscleGroups.join(', ') ?? '',
    equipment: exercise?.equipment ?? '',
    trackingType: exercise?.trackingType ?? 'weight_reps',
    weightMode: exercise?.weightMode ?? 'total',
    weightMultiplier: String(exercise?.weightMultiplier ?? 1),
    defaultRestSeconds: String(exercise?.defaultRestSeconds ?? defaultRest),
    weightIncrementKg: exercise?.weightIncrementKg == null ? '' : String(exercise.weightIncrementKg),
    availableWeightsKg: exercise?.availableWeightsKg?.join(', ') ?? '',
    progressionMethod: exercise?.progressionMethod ?? 'auto',
    targetRir: exercise?.targetRir == null ? '' : String(exercise.targetRir),
    techniqueCues: exercise?.techniqueCues?.join('\n') ?? '',
    alternativeExerciseIds: exercise?.alternativeExerciseIds ?? [],
    notes: exercise?.notes ?? '',
  };
}

/**
 * Create/edit form for an exercise.
 *
 * The weight convention drives every later calculation, so the form explains
 * each option inline instead of hiding it behind documentation.
 */
export function ExerciseFormDialog({
  open,
  exercise,
  existingNames,
  defaultRestSeconds = 120,
  onClose,
  onSaved,
}: {
  open: boolean;
  exercise?: Exercise;
  existingNames: string[];
  defaultRestSeconds?: number;
  onClose: () => void;
  onSaved?: (exercise: Exercise) => void;
}) {
  const toast = useToast();
  const listId = useId();
  const [form, setForm] = useState<FormState>(() => toFormState(exercise, defaultRestSeconds));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Other exercises that can be picked as manual alternatives.
  const otherExercises = useLiveQuery(
    () => db.exercises.filter((entry) => !entry.archived && entry.id !== exercise?.id).toArray(),
    [exercise?.id],
    [],
  );

  useEffect(() => {
    if (open) {
      setForm(toFormState(exercise, defaultRestSeconds));
      setErrors({});
    }
  }, [open, exercise, defaultRestSeconds]);

  const weightModes = useMemo(() => allowedWeightModes(form.trackingType), [form.trackingType]);
  const showMultiplier = form.weightMode === 'per_hand';

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleTrackingTypeChange = (trackingType: TrackingType) => {
    setForm((current) => {
      const allowed = allowedWeightModes(trackingType);
      return {
        ...current,
        trackingType,
        // Keep the current convention if it still applies, otherwise fall back.
        weightMode: allowed.includes(current.weightMode)
          ? current.weightMode
          : defaultWeightMode(trackingType),
      };
    });
  };

  const handleSubmit = async () => {
    const multiplier = parseNumberInput(form.weightMultiplier) ?? 1;
    const rest = parseNumberInput(form.defaultRestSeconds) ?? 0;

    const validation = validateExerciseForm(
      {
        name: form.name,
        weightMultiplier: form.weightMode === 'per_hand' ? multiplier : 1,
        defaultRestSeconds: rest,
      },
      existingNames.filter(
        (name) => name.toLowerCase() !== (exercise?.name ?? '').toLowerCase(),
      ),
    );

    if (Object.keys(validation).length > 0) {
      setErrors(validation as Record<string, string>);
      return;
    }

    const payload = {
      name: form.name.trim(),
      primaryMuscleGroup: form.primaryMuscleGroup.trim(),
      secondaryMuscleGroups: form.secondaryMuscleGroups
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      equipment: form.equipment.trim(),
      trackingType: form.trackingType,
      weightMode: form.weightMode,
      // The multiplier only has a meaning for the "per hand" convention.
      weightMultiplier: form.weightMode === 'per_hand' ? multiplier : 1,
      defaultRestSeconds: Math.round(rest),
      // Progression settings are optional: an empty field stays undefined
      // rather than being filled with a guessed default.
      weightIncrementKg: optionalNumber(form.weightIncrementKg, { min: 0.1, max: 100 }),
      availableWeightsKg: parseWeightList(form.availableWeightsKg),
      progressionMethod: form.progressionMethod === 'auto' ? undefined : form.progressionMethod,
      targetRir: optionalNumber(form.targetRir, { min: 0, max: 10 }),
      techniqueCues: parseCues(form.techniqueCues),
      alternativeExerciseIds:
        form.alternativeExerciseIds.length > 0 ? form.alternativeExerciseIds : undefined,
      notes: form.notes.trim(),
    };

    setSaving(true);
    try {
      if (exercise) {
        await updateExercise(exercise.id, payload);
        toast.show('Übung gespeichert.', 'success');
        onSaved?.({ ...exercise, ...payload });
      } else {
        const created = await createExercise(payload);
        toast.show('Übung angelegt.', 'success');
        onSaved?.(created);
      }
      onClose();
    } catch (error) {
      toast.show(
        error instanceof Error ? error.message : 'Die Übung konnte nicht gespeichert werden.',
        'error',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={exercise ? 'Übung bearbeiten' : 'Neue Übung'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Abbrechen
          </Button>
          <Button variant="primary" onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Speichern …' : 'Speichern'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <TextField
          label="Name"
          value={form.name}
          error={errors.name}
          autoComplete="off"
          placeholder="z. B. Bankdrücken"
          onChange={(event) => update('name', event.target.value)}
        />

        <TextField
          label="Primäre Muskelgruppe"
          value={form.primaryMuscleGroup}
          list={`${listId}-muscles`}
          placeholder="z. B. Brust"
          onChange={(event) => update('primaryMuscleGroup', event.target.value)}
        />
        <datalist id={`${listId}-muscles`}>
          {MUSCLE_GROUP_SUGGESTIONS.map((group) => (
            <option key={group} value={group} />
          ))}
        </datalist>

        <TextField
          label="Sekundäre Muskelgruppen"
          value={form.secondaryMuscleGroups}
          hint="Mehrere durch Komma trennen, z. B. Trizeps, Schultern"
          onChange={(event) => update('secondaryMuscleGroups', event.target.value)}
        />

        <TextField
          label="Equipment"
          value={form.equipment}
          list={`${listId}-equipment`}
          placeholder="z. B. Langhantel"
          onChange={(event) => update('equipment', event.target.value)}
        />
        <datalist id={`${listId}-equipment`}>
          {EQUIPMENT_SUGGESTIONS.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>

        <SelectField
          label="Tracking-Typ"
          value={form.trackingType}
          hint={TRACKING_TYPE_HELP[form.trackingType]}
          onChange={(event) => handleTrackingTypeChange(event.target.value as TrackingType)}
        >
          {(Object.keys(TRACKING_TYPE_LABELS) as TrackingType[]).map((type) => (
            <option key={type} value={type}>
              {TRACKING_TYPE_LABELS[type]}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Gewichtskonvention"
          value={form.weightMode}
          hint={WEIGHT_MODE_HELP[form.weightMode]}
          disabled={weightModes.length <= 1}
          onChange={(event) => update('weightMode', event.target.value as WeightMode)}
        >
          {weightModes.map((mode) => (
            <option key={mode} value={mode}>
              {WEIGHT_MODE_LABELS[mode]}
            </option>
          ))}
        </SelectField>

        {showMultiplier ? (
          <NumberField
            label="Gewichtsmultiplikator"
            decimal
            value={form.weightMultiplier}
            error={errors.weightMultiplier}
            hint="Bei zwei Kurzhanteln à 20 kg ergibt der Multiplikator 2 eine Gesamtlast von 40 kg."
            onChange={(event) => update('weightMultiplier', event.target.value)}
          />
        ) : null}

        <NumberField
          label="Standardpause (Sekunden)"
          value={form.defaultRestSeconds}
          error={errors.defaultRestSeconds}
          onChange={(event) => update('defaultRestSeconds', event.target.value)}
        />

        {/* Optional throughout — the suggestion simply says so when unset. */}
        <details className="rounded-xl border border-border bg-surface-2 p-3">
          <summary className="min-h-[44px] cursor-pointer list-none py-2 text-sm font-medium text-accent">
            Progression (optional)
          </summary>
          <div className="mt-3 grid gap-3">
            <p className="text-xs leading-relaxed text-muted">
              Diese Angaben verbessern die lokale Progressionsempfehlung. Ohne sie wird eine
              Standardsteigerung angenommen — es wird nichts geschätzt oder automatisch geändert.
            </p>

            <NumberField
              label="Kleinste Gewichtssteigerung (kg)"
              decimal
              value={form.weightIncrementKg}
              placeholder="Standard: 2,5"
              onChange={(event) => update('weightIncrementKg', event.target.value)}
            />

            <TextField
              label="Verfügbare Gewichte (kg)"
              value={form.availableWeightsKg}
              hint="Durch Komma trennen, z. B. 10, 12.5, 15, 17.5. Dann wird nur ein tatsächlich vorhandenes Gewicht vorgeschlagen."
              onChange={(event) => update('availableWeightsKg', event.target.value)}
            />

            <SelectField
              label="Bevorzugte Progression"
              value={form.progressionMethod}
              onChange={(event) =>
                update('progressionMethod', event.target.value as ProgressionMethod)
              }
            >
              <option value="auto">Automatisch (nach Tracking-Typ)</option>
              <option value="weight">Zuerst Gewicht steigern</option>
              <option value="reps">Zuerst Wiederholungen steigern</option>
            </SelectField>

            <NumberField
              label="Ziel-RIR"
              decimal
              value={form.targetRir}
              hint="Verbleibende Wiederholungen im Tank. Höher heißt leichter. Leer lassen, wenn du RIR nicht nutzt."
              onChange={(event) => update('targetRir', event.target.value)}
            />
          </div>
        </details>

        <TextAreaField
          label="Technik-Hinweise (optional)"
          value={form.techniqueCues}
          hint="Ein kurzer Hinweis pro Zeile, z. B. Schulterblätter fixieren. Wird im Training angezeigt."
          onChange={(event) => update('techniqueCues', event.target.value)}
        />

        {open && otherExercises.length > 0 ? (
          <details className="rounded-xl border border-border bg-surface-2 p-3">
            <summary className="min-h-[44px] cursor-pointer list-none py-2 text-sm font-medium text-accent">
              Alternativübungen (optional)
              {form.alternativeExerciseIds.length > 0
                ? ` · ${form.alternativeExerciseIds.length}`
                : ''}
            </summary>
            <p className="mb-2 mt-1 text-xs leading-relaxed text-muted">
              Manuell gewählte Ersatzübungen — im Training schnell wählbar, z. B. wenn ein Gerät
              belegt ist.
            </p>
            <div className="grid max-h-56 gap-1 overflow-y-auto">
              {[...otherExercises]
                .sort((a, b) => a.name.localeCompare(b.name, 'de'))
                .map((entry) => {
                  const checked = form.alternativeExerciseIds.includes(entry.id);
                  return (
                    <label key={entry.id} className="flex items-center gap-2 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        className="h-5 w-5 accent-[var(--accent)]"
                        onChange={() =>
                          update(
                            'alternativeExerciseIds',
                            checked
                              ? form.alternativeExerciseIds.filter((id) => id !== entry.id)
                              : [...form.alternativeExerciseIds, entry.id],
                          )
                        }
                      />
                      <span className="min-w-0 truncate">{entry.name}</span>
                    </label>
                  );
                })}
            </div>
          </details>
        ) : null}

        <TextAreaField
          label="Notizen"
          value={form.notes}
          placeholder="z. B. Griffbreite, Sitzposition"
          onChange={(event) => update('notes', event.target.value)}
        />
      </div>
    </Dialog>
  );
}
