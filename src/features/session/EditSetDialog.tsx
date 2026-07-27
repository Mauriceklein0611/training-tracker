import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { NumberField, SelectField } from '@/components/ui/Field';
import { editCompletedSet } from '@/db/repositories/sessions';
import { allowedWeightModes } from '@/services/exerciseRules';
import {
  EQUIPMENT_LABELS,
  EQUIPMENT_VALUES,
  effectiveSetExecution,
  suggestedMultiplierForWeightMode,
  suggestedWeightModeForEquipment,
} from '@/services/equipment';
import { requiredFieldsFor, weightFieldLabel } from '@/services/metrics';
import { hasErrors, parseNumberInput, validateSetInput } from '@/services/validation';
import { SET_TYPE_LABELS, WEIGHT_MODE_LABELS } from '@/utils/format';
import { useToast } from '@/hooks/useToast';
import type {
  Equipment,
  SessionExercise,
  SetType,
  WeightMode,
  WorkoutSet,
} from '@/types';

interface Draft {
  setType: SetType;
  weight: string;
  reps: string;
  duration: string;
  rir: string;
  rpe: string;
  equipment: Equipment;
  weightMode: WeightMode;
  multiplier: string;
}

function toNumber(raw: string): number | undefined {
  const parsed = parseNumberInput(raw);
  return parsed == null || Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Corrects an already-completed set (Feature 2). Prefilled from the set's own
 * effective execution; saving updates the set in place (same id, order and rest
 * data) and never starts a rest timer or creates a new set.
 */
export function EditSetDialog({
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
  const [draft, setDraft] = useState<Draft>(() => seed());
  const [touched, setTouched] = useState(false);
  const [multiplierError, setMultiplierError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  function seed(): Draft {
    const execution = effectiveSetExecution(set, sessionExercise);
    return {
      setType: set.setType,
      weight: set.weightKg == null ? '' : String(set.weightKg),
      reps: set.reps == null ? '' : String(set.reps),
      duration: set.durationSeconds == null ? '' : String(set.durationSeconds),
      rir: set.rir == null ? '' : String(set.rir),
      rpe: set.rpe == null ? '' : String(set.rpe),
      equipment: execution.equipment,
      weightMode: execution.weightMode,
      multiplier: String(execution.weightMultiplier),
    };
  }

  useEffect(() => {
    if (open) {
      setDraft(seed());
      setTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, set.id]);

  const trackingType = set.trackingTypeSnapshot ?? sessionExercise.trackingTypeSnapshot;
  const modes = allowedWeightModes(trackingType);
  const fields = requiredFieldsFor(trackingType);
  const weightLabel = weightFieldLabel(trackingType, draft.weightMode);

  const update = (key: keyof Draft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const chooseEquipment = (next: Equipment) => {
    const mode = suggestedWeightModeForEquipment(next, trackingType);
    setDraft((current) => ({
      ...current,
      equipment: next,
      weightMode: mode,
      multiplier: String(suggestedMultiplierForWeightMode(mode)),
    }));
  };

  const values = {
    setType: draft.setType,
    weightKg: toNumber(draft.weight),
    reps: toNumber(draft.reps),
    durationSeconds: toNumber(draft.duration),
    rir: toNumber(draft.rir),
    rpe: toNumber(draft.rpe),
  };
  const errors = validateSetInput(values, trackingType, draft.weightMode);
  const visibleErrors = touched ? errors : {};

  const handleSave = async () => {
    setTouched(true);
    if (hasErrors(errors)) return;

    // Strict multiplier validation for per-hand work — no silent `?? 2` that
    // would hide a typo behind a wrong load.
    let weightMultiplier = 1;
    if (draft.weightMode === 'per_hand') {
      const parsed = toNumber(draft.multiplier);
      if (parsed == null || !Number.isFinite(parsed) || parsed <= 0 || parsed > 10) {
        setMultiplierError(
          'Bitte einen gültigen Multiplikator zwischen 0 und 10 eingeben.',
        );
        return;
      }
      weightMultiplier = parsed;
    }

    setSaving(true);
    try {
      await editCompletedSet(set.id, {
        ...values,
        equipment: draft.equipment,
        weightMode: draft.weightMode,
        weightMultiplier,
        trackingType,
      });
      toast.show('Satz aktualisiert.', 'success');
      onClose();
    } catch (error) {
      toast.show(
        error instanceof Error
          ? error.message
          : 'Der Satz konnte nicht gespeichert werden.',
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
      title={`Satz ${set.position + 1} bearbeiten`}
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
          label="Satzart"
          containerClassName="col-span-2"
          value={draft.setType}
          onChange={(event) => update('setType', event.target.value)}
        >
          {(Object.keys(SET_TYPE_LABELS) as SetType[]).map((type) => (
            <option key={type} value={type}>
              {SET_TYPE_LABELS[type]}
            </option>
          ))}
        </SelectField>

        {weightLabel ? (
          <NumberField
            label={weightLabel}
            decimal
            value={draft.weight}
            error={visibleErrors.weightKg}
            onChange={(event) => update('weight', event.target.value)}
          />
        ) : null}

        {fields.reps ? (
          <NumberField
            label="Wiederholungen"
            value={draft.reps}
            error={visibleErrors.reps}
            onChange={(event) => update('reps', event.target.value)}
          />
        ) : null}

        {fields.duration ? (
          <NumberField
            label="Dauer (s)"
            value={draft.duration}
            error={visibleErrors.durationSeconds}
            onChange={(event) => update('duration', event.target.value)}
          />
        ) : null}

        <NumberField
          label="RIR (optional)"
          decimal
          value={draft.rir}
          error={visibleErrors.rir}
          onChange={(event) => update('rir', event.target.value)}
        />
        <NumberField
          label="RPE (optional)"
          decimal
          value={draft.rpe}
          error={visibleErrors.rpe}
          onChange={(event) => update('rpe', event.target.value)}
        />

        {trackingType === 'weight_reps' ? (
          <>
            <SelectField
              label="Ausrüstung"
              containerClassName="col-span-2"
              value={draft.equipment}
              onChange={(event) => chooseEquipment(event.target.value as Equipment)}
            >
              {EQUIPMENT_VALUES.map((value) => (
                <option key={value} value={value}>
                  {EQUIPMENT_LABELS[value]}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Gewichtskonvention"
              containerClassName={
                draft.weightMode === 'per_hand' ? undefined : 'col-span-2'
              }
              value={draft.weightMode}
              disabled={modes.length <= 1}
              onChange={(event) => update('weightMode', event.target.value)}
            >
              {modes.map((mode) => (
                <option key={mode} value={mode}>
                  {WEIGHT_MODE_LABELS[mode]}
                </option>
              ))}
            </SelectField>
            {draft.weightMode === 'per_hand' ? (
              <NumberField
                label="Multiplikator"
                decimal
                value={draft.multiplier}
                error={multiplierError}
                onChange={(event) => {
                  update('multiplier', event.target.value);
                  setMultiplierError(undefined);
                }}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
