import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { NumberField, SelectField } from '@/components/ui/Field';
import { setSessionExerciseExecution } from '@/db/repositories/sessions';
import { allowedWeightModes } from '@/services/exerciseRules';
import {
  EQUIPMENT_VALUES,
  effectiveSetExecution,
  suggestedMultiplierForWeightMode,
  suggestedWeightModeForEquipment,
} from '@/services/equipment';
import { weightFieldLabel } from '@/services/metrics';
import { parseNumberInput } from '@/services/validation';
import { useToast } from '@/hooks/useToast';
import type { Equipment, SessionExercise, WeightMode } from '@/types';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('session');
  const { t: tDomain } = useTranslation('domain');
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
        setMultiplierError(t('execution.multiplierInvalid'));
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
      toast.show(t('execution.updated'), 'success');
      onClose();
    } catch {
      toast.show(t('execution.failed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('execution.title')}
      description={t('execution.description')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t('action.cancel')}
          </Button>
          <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
            {saving ? t('action.saving') : t('action.apply')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-1 rounded-xl bg-surface-2 p-2 text-xs leading-relaxed text-muted">
          <p>
            <span className="font-medium">{t('execution.standard')}</span> (
            {t('execution.standardContext')}):{' '}
            {tDomain(`equipment.${standard?.equipment ?? 'unspecified'}`)} ·{' '}
            {tDomain(
              `weightMode.${standard?.weightMode ?? sessionExercise.weightModeSnapshot}`,
            )}
            {standard?.weightMode === 'per_hand' ? ` ×${standard.weightMultiplier}` : ''}
          </p>
          <p>
            <span className="font-medium">{t('execution.current')}</span> (
            {t('execution.currentContext')}): {tDomain(`equipment.${current.equipment}`)}{' '}
            · {tDomain(`weightMode.${current.weightMode}`)}
            {current.weightMode === 'per_hand' ? ` ×${current.weightMultiplier}` : ''}
          </p>
        </div>

        <SelectField
          label={t('field.equipment')}
          value={equipment}
          onChange={(event) => chooseEquipment(event.target.value as Equipment)}
        >
          {EQUIPMENT_VALUES.map((value) => (
            <option key={value} value={value}>
              {tDomain(`equipment.${value}`)}
            </option>
          ))}
        </SelectField>

        <SelectField
          label={t('field.weightMode')}
          value={weightMode}
          disabled={modes.length <= 1}
          onChange={(event) => setWeightMode(event.target.value as WeightMode)}
        >
          {modes.map((mode) => (
            <option key={mode} value={mode}>
              {tDomain(`weightMode.${mode}`)}
            </option>
          ))}
        </SelectField>

        {weightMode === 'per_hand' ? (
          <NumberField
            label={t('field.weightMultiplier')}
            decimal
            value={multiplier}
            error={multiplierError}
            hint={t('execution.multiplierHint')}
            onChange={(event) => {
              setMultiplier(event.target.value);
              setMultiplierError(undefined);
            }}
          />
        ) : null}

        {weightLabel ? (
          <p className="text-xs text-muted">
            {t('execution.weightInput', { label: weightLabel })}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
