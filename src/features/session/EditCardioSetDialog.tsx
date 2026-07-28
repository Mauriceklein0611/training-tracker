import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { NumberField, SelectField } from '@/components/ui/Field';
import { editCompletedCardioSet } from '@/db/repositories/sessions';
import { effectiveSetExecution } from '@/services/equipment';
import {
  CARDIO_MODALITY_LABELS,
  CARDIO_MODALITY_VALUES,
  prefersMeters,
} from '@/services/cardio';
import {
  cardioSectionComplete,
  hasErrors,
  parseNumberInput,
  validateCardioSetInput,
  type CardioSetInputValues,
} from '@/services/validation';
import { useToast } from '@/hooks/useToast';
import type { CardioModality, SessionExercise, WorkoutSet } from '@/types';

interface Draft {
  modality: CardioModality;
  duration: string;
  distance: string;
  rpe: string;
  heartRate: string;
  calories: string;
  elevation: string;
  cadence: string;
  resistance: string;
}

function num(raw: string): number | undefined {
  const parsed = parseNumberInput(raw);
  return parsed == null || Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Corrects an already-completed cardio section. Prefilled from the section's own
 * effective execution; saving updates it in place (same id, order and rest data)
 * via the safe repository path, so records and analysis recompute from the
 * corrected raw data.
 */
export function EditCardioSetDialog({
  open,
  set,
  sessionExercise,
  onClose,
}: {
  open: boolean;
  set: WorkoutSet;
  sessionExercise: SessionExercise;
  onClose: () => void;
}) {
  const toast = useToast();
  const execution = effectiveSetExecution(set, sessionExercise);
  const modality = execution.cardioModality ?? 'other';
  const distanceInMeters = prefersMeters(modality);

  function seed(): Draft {
    return {
      modality,
      duration: set.durationSeconds == null ? '' : String(set.durationSeconds),
      distance:
        set.distanceMeters == null
          ? ''
          : distanceInMeters
            ? String(set.distanceMeters)
            : String(set.distanceMeters / 1000),
      rpe: set.rpe == null ? '' : String(set.rpe),
      heartRate: set.averageHeartRateBpm == null ? '' : String(set.averageHeartRateBpm),
      calories: set.caloriesKcal == null ? '' : String(set.caloriesKcal),
      elevation: set.elevationGainMeters == null ? '' : String(set.elevationGainMeters),
      cadence: set.cadenceRpm == null ? '' : String(set.cadenceRpm),
      resistance: set.resistanceLevel == null ? '' : String(set.resistanceLevel),
    };
  }

  const [draft, setDraft] = useState<Draft>(() => seed());
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(seed());
      setTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, set.id]);

  const update = (key: keyof Draft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const values = {
    durationSeconds: num(draft.duration),
    distanceMeters:
      num(draft.distance) == null
        ? undefined
        : distanceInMeters
          ? num(draft.distance)
          : (num(draft.distance) as number) * 1000,
    averageHeartRateBpm: num(draft.heartRate),
    caloriesKcal: num(draft.calories),
    elevationGainMeters: num(draft.elevation),
    cadenceRpm: num(draft.cadence),
    resistanceLevel: num(draft.resistance),
    rpe: num(draft.rpe),
  };
  const errors = validateCardioSetInput(values);
  const err = (key: keyof CardioSetInputValues) => (touched ? errors[key] : undefined);

  const handleSave = async () => {
    setTouched(true);
    if (!cardioSectionComplete(values)) {
      toast.show('Bitte eine Dauer oder eine Distanz eingeben.', 'error');
      return;
    }
    if (hasErrors(errors)) return;
    setSaving(true);
    try {
      await editCompletedCardioSet(set.id, { ...values, cardioModality: draft.modality });
      toast.show('Cardio-Abschnitt aktualisiert.', 'success');
      onClose();
    } catch (error) {
      toast.show(
        error instanceof Error
          ? error.message
          : 'Der Abschnitt konnte nicht gespeichert werden.',
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
      title={`Cardio-Abschnitt ${set.position + 1} bearbeiten`}
      description="Korrigiert die erfassten Werte. Reihenfolge, Pausen und Zeitstempel bleiben erhalten."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Abbrechen
          </Button>
          <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Speichern …' : 'Speichern'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        <SelectField
          label="Aktivität"
          containerClassName="col-span-2"
          value={draft.modality}
          onChange={(event) => update('modality', event.target.value)}
        >
          {CARDIO_MODALITY_VALUES.map((value) => (
            <option key={value} value={value}>
              {CARDIO_MODALITY_LABELS[value]}
            </option>
          ))}
        </SelectField>
        <NumberField
          label="Dauer (s)"
          value={draft.duration}
          error={err('durationSeconds')}
          onChange={(event) => update('duration', event.target.value)}
        />
        <NumberField
          label={`Distanz (${distanceInMeters ? 'm' : 'km'})`}
          decimal
          value={draft.distance}
          error={err('distanceMeters')}
          onChange={(event) => update('distance', event.target.value)}
        />
        <NumberField
          label="RPE (optional)"
          decimal
          containerClassName="col-span-2"
          value={draft.rpe}
          error={err('rpe')}
          onChange={(event) => update('rpe', event.target.value)}
        />
        <NumberField
          label="Ø Herzfrequenz (bpm)"
          value={draft.heartRate}
          error={err('averageHeartRateBpm')}
          onChange={(event) => update('heartRate', event.target.value)}
        />
        <NumberField
          label="Kalorien (kcal)"
          value={draft.calories}
          error={err('caloriesKcal')}
          onChange={(event) => update('calories', event.target.value)}
        />
        <NumberField
          label="Höhenmeter (m)"
          value={draft.elevation}
          error={err('elevationGainMeters')}
          onChange={(event) => update('elevation', event.target.value)}
        />
        <NumberField
          label="Kadenz (rpm)"
          value={draft.cadence}
          error={err('cadenceRpm')}
          onChange={(event) => update('cadence', event.target.value)}
        />
        <NumberField
          label="Widerstand"
          containerClassName="col-span-2"
          value={draft.resistance}
          error={err('resistanceLevel')}
          onChange={(event) => update('resistance', event.target.value)}
        />
      </div>
    </Dialog>
  );
}
