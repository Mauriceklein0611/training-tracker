import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { NumberField, SelectField } from '@/components/ui/Field';
import { deleteSet, updateSet } from '@/db/repositories/sessions';
import { requiredFieldsFor, weightFieldLabel } from '@/services/metrics';
import { hasErrors, parseNumberInput, validateSetInput } from '@/services/validation';
import type { SessionExercise, SetType, WorkoutSet } from '@/types';
import { SET_TYPES, setTypeLabel } from '@/utils/format';
import { useToast } from '@/hooks/useToast';

/**
 * Correcting a set of a past workout.
 *
 * The same validation rules as the live view apply, and saving updates the
 * record in place so every analysis picks the change up immediately.
 */
export function SetEditDialog({
  set,
  sessionExercise,
  onClose,
}: {
  set: WorkoutSet | null;
  sessionExercise: SessionExercise | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    setType: 'working' as SetType,
    weight: '',
    reps: '',
    duration: '',
    rir: '',
    rpe: '',
    restTarget: '',
    restActual: '',
  });
  const [touched, setTouched] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!set) return;
    setTouched(false);
    setConfirmDelete(false);
    setForm({
      setType: set.setType,
      weight: set.weightKg == null ? '' : String(set.weightKg),
      reps: set.reps == null ? '' : String(set.reps),
      duration: set.durationSeconds == null ? '' : String(set.durationSeconds),
      rir: set.rir == null ? '' : String(set.rir),
      rpe: set.rpe == null ? '' : String(set.rpe),
      restTarget: String(set.restTargetSeconds ?? 0),
      restActual: set.restActualSeconds == null ? '' : String(set.restActualSeconds),
    });
  }, [set]);

  if (!set || !sessionExercise) return null;

  const trackingType = sessionExercise.trackingTypeSnapshot;
  const fields = requiredFieldsFor(trackingType);
  const weightLabel = weightFieldLabel(trackingType, sessionExercise.weightModeSnapshot);

  const toNumber = (raw: string) => {
    const parsed = parseNumberInput(raw);
    return parsed == null || Number.isNaN(parsed) ? undefined : parsed;
  };

  const values = {
    weightKg: toNumber(form.weight),
    reps: toNumber(form.reps),
    durationSeconds: toNumber(form.duration),
    rir: toNumber(form.rir),
    rpe: toNumber(form.rpe),
  };
  const errors = validateSetInput(
    values,
    trackingType,
    sessionExercise.weightModeSnapshot,
  );
  const visibleErrors = touched ? errors : {};

  const handleSave = async () => {
    setTouched(true);
    if (hasErrors(errors)) return;
    await updateSet(set.id, {
      ...values,
      setType: form.setType,
      restTargetSeconds: Math.max(0, Math.round(toNumber(form.restTarget) ?? 0)),
      restActualSeconds:
        form.restActual.trim() === ''
          ? undefined
          : Math.max(0, Math.round(toNumber(form.restActual) ?? 0)),
    });
    toast.show('Satz aktualisiert.', 'success');
    onClose();
  };

  return (
    <Dialog
      open={Boolean(set)}
      onClose={onClose}
      title={`Satz ${set.position + 1} bearbeiten`}
      description={sessionExercise.exerciseNameSnapshot}
      footer={
        <>
          <Button
            variant={confirmDelete ? 'danger' : 'ghost'}
            onClick={async () => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              await deleteSet(set.id);
              toast.show('Satz gelöscht.', 'info');
              onClose();
            }}
          >
            {confirmDelete ? 'Wirklich löschen' : 'Löschen'}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" onClick={() => void handleSave()}>
            Speichern
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Satzart"
          containerClassName="col-span-2"
          value={form.setType}
          onChange={(event) =>
            setForm((current) => ({ ...current, setType: event.target.value as SetType }))
          }
        >
          {SET_TYPES.map((type) => (
            <option key={type} value={type}>
              {setTypeLabel(type)}
            </option>
          ))}
        </SelectField>

        {weightLabel ? (
          <NumberField
            label={weightLabel}
            decimal
            value={form.weight}
            error={visibleErrors.weightKg}
            onChange={(event) =>
              setForm((current) => ({ ...current, weight: event.target.value }))
            }
          />
        ) : null}

        {fields.reps ? (
          <NumberField
            label="Wiederholungen"
            value={form.reps}
            error={visibleErrors.reps}
            onChange={(event) =>
              setForm((current) => ({ ...current, reps: event.target.value }))
            }
          />
        ) : null}

        {fields.duration ? (
          <NumberField
            label="Dauer (s)"
            value={form.duration}
            error={visibleErrors.durationSeconds}
            onChange={(event) =>
              setForm((current) => ({ ...current, duration: event.target.value }))
            }
          />
        ) : null}

        <NumberField
          label="RIR"
          decimal
          value={form.rir}
          error={visibleErrors.rir}
          onChange={(event) =>
            setForm((current) => ({ ...current, rir: event.target.value }))
          }
        />
        <NumberField
          label="RPE"
          decimal
          value={form.rpe}
          error={visibleErrors.rpe}
          onChange={(event) =>
            setForm((current) => ({ ...current, rpe: event.target.value }))
          }
        />
        <NumberField
          label="Zielpause (s)"
          value={form.restTarget}
          onChange={(event) =>
            setForm((current) => ({ ...current, restTarget: event.target.value }))
          }
        />
        <NumberField
          label="Tatsächliche Pause (s)"
          value={form.restActual}
          onChange={(event) =>
            setForm((current) => ({ ...current, restActual: event.target.value }))
          }
        />
      </div>
    </Dialog>
  );
}
