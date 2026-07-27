import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { NumberField, SelectField } from '@/components/ui/Field';
import { setSessionExerciseExecution } from '@/db/repositories/sessions';
import { allowedWeightModes } from '@/services/exerciseRules';
import {
  EQUIPMENT_LABELS,
  EQUIPMENT_VALUES,
  effectiveSetExecution,
  equipmentLabel,
  suggestedMultiplierForWeightMode,
  suggestedWeightModeForEquipment,
} from '@/services/equipment';
import { weightFieldLabel } from '@/services/metrics';
import { parseNumberInput } from '@/services/validation';
import { WEIGHT_MODE_LABELS } from '@/utils/format';
import { useToast } from '@/hooks/useToast';
import type { Equipment, SessionExercise, WeightMode } from '@/types';

/**
 * Changes the execution (equipment + weight convention) of one exercise for the
 * current workout only (Feature 3). The stored exercise and its default stay
 * untouched; the change applies to the exercise's following sets. Already
 * completed sets keep the execution they were performed with.
 */
export function ExecutionChangeDialog({
  open,
  sessionExercise,
  defaultEquipment,
  onClose,
}: {
  open: boolean;
  sessionExercise: SessionExercise;
  /** The exercise's stored default equipment, shown for reference. */
  defaultEquipment?: Equipment;
  onClose: () => void;
}) {
  const toast = useToast();
  const trackingType = sessionExercise.trackingTypeSnapshot;
  const modes = allowedWeightModes(trackingType);

  const current = effectiveSetExecution(
    // No per-set snapshot here — we want the session-exercise's current execution.
    {},
    sessionExercise,
  );

  const [equipment, setEquipment] = useState<Equipment>(current.equipment);
  const [weightMode, setWeightMode] = useState<WeightMode>(current.weightMode);
  const [multiplier, setMultiplier] = useState(String(current.weightMultiplier));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setEquipment(current.equipment);
      setWeightMode(current.weightMode);
      setMultiplier(String(current.weightMultiplier));
    }
    // Only reseed when the dialog (re)opens for this exercise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessionExercise.id]);

  const chooseEquipment = (next: Equipment) => {
    setEquipment(next);
    // Suggest — never force — a matching convention for the new equipment.
    const suggestedMode = suggestedWeightModeForEquipment(next, trackingType);
    setWeightMode(suggestedMode);
    setMultiplier(String(suggestedMultiplierForWeightMode(suggestedMode)));
  };

  const weightLabel = weightFieldLabel(trackingType, weightMode);

  const handleSave = async () => {
    setSaving(true);
    try {
      const parsed = parseNumberInput(multiplier) ?? 2;
      await setSessionExerciseExecution(sessionExercise.id, {
        equipment,
        weightMode,
        weightMultiplier: weightMode === 'per_hand' ? parsed : 1,
      });
      toast.show('Ausführung für dieses Training geändert.', 'success');
      onClose();
    } catch {
      toast.show('Die Ausführung konnte nicht geändert werden.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Ausführung ändern"
      description="Gilt nur für dieses Training und für die folgenden Sätze dieser Übung. Die gespeicherte Übung bleibt unverändert."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Abbrechen
          </Button>
          <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Speichern …' : 'Übernehmen'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <p className="rounded-xl bg-surface-2 p-2 text-xs leading-relaxed text-muted">
          Standardausführung: {equipmentLabel(defaultEquipment)} ·{' '}
          {WEIGHT_MODE_LABELS[sessionExercise.weightModeSnapshot]}
        </p>

        <SelectField
          label="Ausrüstung"
          value={equipment}
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
          value={weightMode}
          disabled={modes.length <= 1}
          onChange={(event) => setWeightMode(event.target.value as WeightMode)}
        >
          {modes.map((mode) => (
            <option key={mode} value={mode}>
              {WEIGHT_MODE_LABELS[mode]}
            </option>
          ))}
        </SelectField>

        {weightMode === 'per_hand' ? (
          <NumberField
            label="Gewichtsmultiplikator"
            decimal
            value={multiplier}
            hint="Bei zwei Kurzhanteln à 20 kg ergibt der Multiplikator 2 eine Gesamtlast von 40 kg."
            onChange={(event) => setMultiplier(event.target.value)}
          />
        ) : null}

        {weightLabel ? (
          <p className="text-xs text-muted">
            Gewichtseingabe: <span className="font-medium">{weightLabel}</span>
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
