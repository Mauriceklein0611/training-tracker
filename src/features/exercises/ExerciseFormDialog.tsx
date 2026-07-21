import { useEffect, useId, useMemo, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { NumberField, SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { createExercise, updateExercise } from '@/db/repositories/exercises';
import { validateExerciseForm, parseNumberInput } from '@/services/validation';
import type { Exercise, TrackingType, WeightMode } from '@/types';
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
  notes: string;
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
