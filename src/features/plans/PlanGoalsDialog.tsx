import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import {
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/ui/Field';
import { updatePlan, type PlanEditableFields } from '@/db/repositories/plans';
import { parseNumberInput } from '@/services/validation';
import type { ExperienceLevel, PlanGoalType, TrainingPlan } from '@/types';

/** Edits a plan's goals and metadata (Phase 3). Goals are targets, never data. */
export function PlanGoalsDialog({
  plan,
  open,
  onClose,
}: {
  plan: TrainingPlan;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('plans');
  const { t: tCommon } = useTranslation();
  const [form, setForm] = useState<PlanEditableFields>({});

  // Load the plan's current values whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    setForm({
      goalType: plan.goalType,
      goalText: plan.goalText ?? '',
      focusNote: plan.focusNote ?? '',
      experienceLevel: plan.experienceLevel,
      sessionsPerWeekTarget: plan.sessionsPerWeekTarget,
      startDate: plan.startDate,
      plannedWeeks: plan.plannedWeeks,
      restrictions: plan.restrictions ?? '',
      targetBodyWeightKg: plan.targetBodyWeightKg,
      targetBodyFatPercent: plan.targetBodyFatPercent,
    });
  }, [open, plan]);

  const num = (value: string): number | undefined => {
    const parsed = parseNumberInput(value);
    return parsed == null ? undefined : parsed;
  };

  const handleSave = async () => {
    await updatePlan(plan.id, {
      goalType: form.goalType,
      goalText: form.goalText?.trim() || undefined,
      focusNote: form.focusNote?.trim() || undefined,
      experienceLevel: form.experienceLevel,
      sessionsPerWeekTarget: form.sessionsPerWeekTarget,
      startDate: form.startDate || undefined,
      plannedWeeks: form.plannedWeeks,
      restrictions: form.restrictions?.trim() || undefined,
      targetBodyWeightKg: form.targetBodyWeightKg,
      targetBodyFatPercent: form.targetBodyFatPercent,
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={t('goalsDialog.title')} size="lg">
      <div className="grid gap-3">
        <SelectField
          label={t('goalsDialog.goalType')}
          value={form.goalType ?? ''}
          onChange={(event) =>
            setForm((f) => ({
              ...f,
              goalType: (event.target.value || undefined) as PlanGoalType | undefined,
            }))
          }
        >
          <option value="">{t('goalsDialog.unset')}</option>
          {(
            ['muscle', 'strength', 'fitness', 'fatloss', 'maintenance', 'custom'] as const
          ).map((value) => (
            <option key={value} value={value}>
              {t(`goal.${value}`)}
            </option>
          ))}
        </SelectField>

        {form.goalType === 'custom' ? (
          <TextField
            label={t('goalsDialog.customGoal')}
            value={form.goalText ?? ''}
            onChange={(event) => setForm((f) => ({ ...f, goalText: event.target.value }))}
          />
        ) : null}

        <SelectField
          label={t('goalsDialog.experience')}
          value={form.experienceLevel ?? ''}
          onChange={(event) =>
            setForm((f) => ({
              ...f,
              experienceLevel: (event.target.value || undefined) as
                ExperienceLevel | undefined,
            }))
          }
        >
          <option value="">{t('goalsDialog.unset')}</option>
          {(['beginner', 'intermediate', 'advanced'] as const).map((value) => (
            <option key={value} value={value}>
              {t(`goalsDialog.experienceOptions.${value}`)}
            </option>
          ))}
        </SelectField>

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={t('goalsDialog.sessionsWeek')}
            value={
              form.sessionsPerWeekTarget != null ? String(form.sessionsPerWeekTarget) : ''
            }
            onChange={(event) =>
              setForm((f) => ({ ...f, sessionsPerWeekTarget: num(event.target.value) }))
            }
          />
          <NumberField
            label={t('goalsDialog.durationWeeks')}
            value={form.plannedWeeks != null ? String(form.plannedWeeks) : ''}
            onChange={(event) =>
              setForm((f) => ({ ...f, plannedWeeks: num(event.target.value) }))
            }
          />
        </div>

        <TextField
          label={t('goalsDialog.startDate')}
          type="date"
          value={form.startDate ?? ''}
          onChange={(event) => setForm((f) => ({ ...f, startDate: event.target.value }))}
        />

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={t('goalsDialog.targetWeight')}
            value={form.targetBodyWeightKg != null ? String(form.targetBodyWeightKg) : ''}
            onChange={(event) =>
              setForm((f) => ({ ...f, targetBodyWeightKg: num(event.target.value) }))
            }
          />
          <NumberField
            label={t('goalsDialog.targetBodyFat')}
            value={
              form.targetBodyFatPercent != null ? String(form.targetBodyFatPercent) : ''
            }
            onChange={(event) =>
              setForm((f) => ({ ...f, targetBodyFatPercent: num(event.target.value) }))
            }
          />
        </div>

        <TextAreaField
          label={t('goalsDialog.focus')}
          value={form.focusNote ?? ''}
          onChange={(event) => setForm((f) => ({ ...f, focusNote: event.target.value }))}
        />
        <TextAreaField
          label={t('goalsDialog.restrictions')}
          value={form.restrictions ?? ''}
          placeholder={t('goalsDialog.restrictionsPlaceholder')}
          onChange={(event) =>
            setForm((f) => ({ ...f, restrictions: event.target.value }))
          }
        />

        <p className="text-xs text-muted">{t('goalsDialog.hint')}</p>
        <Button variant="primary" fullWidth onClick={() => void handleSave()}>
          {tCommon('action.save')}
        </Button>
      </div>
    </Dialog>
  );
}
