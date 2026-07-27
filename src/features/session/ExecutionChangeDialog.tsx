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
  standard,
  onClose,
}: {
  open: boolean;
  sessionExercise: SessionExercise;
  /**
   * The exercise's *stored* standard execution (equipment + weight convention),
   * from the unchanged exercise master record. Shown alongside the current
   * (possibly already switched) execution so the two states are never confused.
   */
  standard?: {
    equipment?: Equipment;
    weightMode: WeightMode;
    weightMultiplier: number;
  };
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
  const [multiplierError, setMultiplierError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setEquipment(current.equipment);
      setWeightMode(current.weightMode);
      setMultiplier(String(current.weightMultiplier));
      setMultiplierError(undefined);
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
    setMultiplierError(undefined);
  };

  const weightLabel = weightFieldLabel(trackingType, weightMode);

  const handleSave = async () => {
    // The multiplier is validated strictly for per-hand work — no silent `?? 2`
    // fallback or clamping that would hide a typo behind a wrong load.
    let weightMultiplier = 1;
    if (weightMode === 'per_hand') {
      const parsed = parseNumberInput(multiplier);
      if (parsed == null || !Number.isFinite(parsed) || parsed <= 0 || parsed > 10) {
        setMultiplierError(
          'Bitte einen gültigen Multiplikator zwischen 0 und 10 eingeben (z. B. 2 für zwei Hanteln).',
        );
        return;
      }
      weightMultiplier = parsed;
    }
    setSaving(true);
    try {
      await setSessionExerciseExecution(sessionExercise.id, {
        equipment,
        weightMode,
        weightMultiplier,
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
        <div className="grid gap-1 rounded-xl bg-surface-2 p-2 text-xs leading-relaxed text-muted">
          <p>
            <span className="font-medium">Standard</span> (gespeicherte Übung):{' '}
            {equipmentLabel(standard?.equipment)} ·{' '}
            {
              WEIGHT_MODE_LABELS[
                standard?.weightMode ?? sessionExercise.weightModeSnapshot
              ]
            }
            {standard?.weightMode === 'per_hand' ? ` ×${standard.weightMultiplier}` : ''}
          </p>
          <p>
            <span className="font-medium">Aktuell</span> (dieses Training):{' '}
            {equipmentLabel(current.equipment)} · {WEIGHT_MODE_LABELS[current.weightMode]}
            {current.weightMode === 'per_hand' ? ` ×${current.weightMultiplier}` : ''}
          </p>
        </div>

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
            error={multiplierError}
            hint="Bei zwei Kurzhanteln à 20 kg ergibt der Multiplikator 2 eine Gesamtlast von 40 kg."
            onChange={(event) => {
              setMultiplier(event.target.value);
              setMultiplierError(undefined);
            }}
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
