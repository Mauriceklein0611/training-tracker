import { useEffect, useId, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import {
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/ui/Field';
import { createExercise, updateExercise } from '@/db/repositories/exercises';
import { validateExerciseForm, parseNumberInput } from '@/services/validation';
import { allowedWeightModes, defaultWeightModeFor } from '@/services/exerciseRules';
import { normalizeMuscleQuery } from '@/constants/muscleGroups';
import { MuscleGroupChips } from '@/features/exercises/MuscleGroupChips';
import { MuscleGroupPicker } from '@/features/exercises/MuscleGroupPicker';
import type { Exercise, ProgressionMethod, TrackingType, WeightMode } from '@/types';
import {
  EQUIPMENT_SUGGESTIONS,
  TRACKING_TYPE_HELP,
  TRACKING_TYPE_LABELS,
  WEIGHT_MODE_HELP,
  WEIGHT_MODE_LABELS,
} from '@/utils/format';
import { useToast } from '@/hooks/useToast';

interface FormState {
  name: string;
  primaryMuscleGroup: string;
  secondaryMuscleGroups: string[];
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
function optionalNumber(
  raw: string,
  range: { min: number; max: number },
): number | undefined {
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
    .filter(
      (value): value is number => value != null && Number.isFinite(value) && value > 0,
    )
    .sort((a, b) => a - b);
  // Deduplicate, so a typo cannot produce two identical rack entries.
  const unique = [...new Set(values)];
  return unique.length > 0 ? unique : undefined;
}

function toFormState(
  exercise?: Exercise,
  defaultRest = 120,
  initialName = '',
): FormState {
  return {
    // A new exercise created straight from a search prefills the searched name;
    // an existing exercise always keeps its own name.
    name: exercise?.name ?? initialName.trim(),
    primaryMuscleGroup: exercise?.primaryMuscleGroup ?? '',
    secondaryMuscleGroups: exercise?.secondaryMuscleGroups ?? [],
    equipment: exercise?.equipment ?? '',
    trackingType: exercise?.trackingType ?? 'weight_reps',
    weightMode: exercise?.weightMode ?? 'total',
    weightMultiplier: String(exercise?.weightMultiplier ?? 1),
    defaultRestSeconds: String(exercise?.defaultRestSeconds ?? defaultRest),
    weightIncrementKg:
      exercise?.weightIncrementKg == null ? '' : String(exercise.weightIncrementKg),
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
  initialName = '',
  onClose,
  onSaved,
}: {
  open: boolean;
  exercise?: Exercise;
  existingNames: string[];
  defaultRestSeconds?: number;
  /** Prefills the name for a brand-new exercise, e.g. from an unmatched search. */
  initialName?: string;
  onClose: () => void;
  onSaved?: (exercise: Exercise) => void;
}) {
  const toast = useToast();
  const listId = useId();
  const [form, setForm] = useState<FormState>(() =>
    toFormState(exercise, defaultRestSeconds, initialName),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [pickerMode, setPickerMode] = useState<'primary' | 'secondary' | null>(null);

  // Other exercises that can be picked as manual alternatives.
  const otherExercises = useLiveQuery(
    () =>
      db.exercises
        .filter((entry) => !entry.archived && entry.id !== exercise?.id)
        .toArray(),
    [exercise?.id],
    [],
  );

  useEffect(() => {
    if (open) {
      setForm(toFormState(exercise, defaultRestSeconds, initialName));
      setErrors({});
    }
  }, [open, exercise, defaultRestSeconds, initialName]);

  const weightModes = useMemo(
    () => allowedWeightModes(form.trackingType),
    [form.trackingType],
  );
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
          : defaultWeightModeFor(trackingType),
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

    const primary = form.primaryMuscleGroup.trim();
    const payload = {
      name: form.name.trim(),
      primaryMuscleGroup: primary,
      // Defensive: keep non-empty, unique and never the primary group.
      secondaryMuscleGroups: [
        ...new Set(form.secondaryMuscleGroups.map((value) => value.trim())),
      ]
        .filter(Boolean)
        .filter((value) => normalizeMuscleQuery(value) !== normalizeMuscleQuery(primary)),
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
      progressionMethod:
        form.progressionMethod === 'auto' ? undefined : form.progressionMethod,
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
        error instanceof Error
          ? error.message
          : 'Die Übung konnte nicht gespeichert werden.',
        'error',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={exercise ? 'Übung bearbeiten' : 'Neue Übung'}
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Abbrechen
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleSubmit()}
              disabled={saving}
            >
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

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Primäre Muskelgruppe</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPickerMode('primary')}
              >
                {form.primaryMuscleGroup ? 'Ändern' : 'Wählen'}
              </Button>
            </div>
            <MuscleGroupChips
              primary={form.primaryMuscleGroup || undefined}
              secondary={[]}
              onRemovePrimary={() => update('primaryMuscleGroup', '')}
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Sekundäre Muskelgruppen</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPickerMode('secondary')}
              >
                Hinzufügen
              </Button>
            </div>
            <MuscleGroupChips
              secondary={form.secondaryMuscleGroups}
              onRemoveSecondary={(label) =>
                update(
                  'secondaryMuscleGroups',
                  form.secondaryMuscleGroups.filter((value) => value !== label),
                )
              }
            />
          </div>

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
            onChange={(event) =>
              handleTrackingTypeChange(event.target.value as TrackingType)
            }
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
                Diese Angaben verbessern die lokale Progressionsempfehlung. Ohne sie wird
                eine Standardsteigerung angenommen — es wird nichts geschätzt oder
                automatisch geändert.
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
                Manuell gewählte Ersatzübungen — im Training schnell wählbar, z. B. wenn
                ein Gerät belegt ist.
              </p>
              <div className="grid max-h-56 gap-1 overflow-y-auto">
                {[...otherExercises]
                  .sort((a, b) => a.name.localeCompare(b.name, 'de'))
                  .map((entry) => {
                    const checked = form.alternativeExerciseIds.includes(entry.id);
                    return (
                      <label
                        key={entry.id}
                        className="flex items-center gap-2 py-1 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          className="h-5 w-5 accent-[var(--accent)]"
                          onChange={() =>
                            update(
                              'alternativeExerciseIds',
                              checked
                                ? form.alternativeExerciseIds.filter(
                                    (id) => id !== entry.id,
                                  )
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

      {pickerMode ? (
        <MuscleGroupPicker
          open
          mode={pickerMode === 'primary' ? 'single' : 'multiple'}
          title={
            pickerMode === 'primary' ? 'Primäre Muskelgruppe' : 'Sekundäre Muskelgruppen'
          }
          selected={
            pickerMode === 'primary'
              ? form.primaryMuscleGroup
                ? [form.primaryMuscleGroup]
                : []
              : form.secondaryMuscleGroups
          }
          excludeLabels={
            pickerMode === 'secondary' && form.primaryMuscleGroup
              ? [form.primaryMuscleGroup]
              : []
          }
          onChange={(next) => {
            if (pickerMode === 'primary') {
              const label = next[0] ?? '';
              setForm((current) => ({
                ...current,
                primaryMuscleGroup: label,
                // A new primary can never remain in the secondary selection.
                secondaryMuscleGroups: current.secondaryMuscleGroups.filter(
                  (value) => normalizeMuscleQuery(value) !== normalizeMuscleQuery(label),
                ),
              }));
            } else {
              update('secondaryMuscleGroups', next);
            }
          }}
          onClose={() => setPickerMode(null)}
        />
      ) : null}
    </>
  );
}
