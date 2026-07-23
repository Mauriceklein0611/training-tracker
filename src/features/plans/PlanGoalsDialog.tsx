import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import {
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/ui/Field';
import { updatePlan, type PlanEditableFields } from '@/db/repositories/plans';
import { EXPERIENCE_LEVEL_LABELS, PLAN_GOAL_TYPE_LABELS } from '@/services/planGoals';
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
    <Dialog open={open} onClose={onClose} title="Ziele & Fokus" size="lg">
      <div className="grid gap-3">
        <SelectField
          label="Zieltyp"
          value={form.goalType ?? ''}
          onChange={(event) =>
            setForm((f) => ({
              ...f,
              goalType: (event.target.value || undefined) as PlanGoalType | undefined,
            }))
          }
        >
          <option value="">Nicht festgelegt</option>
          {Object.entries(PLAN_GOAL_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>

        {form.goalType === 'custom' ? (
          <TextField
            label="Eigenes Ziel"
            value={form.goalText ?? ''}
            onChange={(event) => setForm((f) => ({ ...f, goalText: event.target.value }))}
          />
        ) : null}

        <SelectField
          label="Erfahrungsniveau"
          value={form.experienceLevel ?? ''}
          onChange={(event) =>
            setForm((f) => ({
              ...f,
              experienceLevel: (event.target.value || undefined) as
                ExperienceLevel | undefined,
            }))
          }
        >
          <option value="">Nicht festgelegt</option>
          {Object.entries(EXPERIENCE_LEVEL_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Einheiten / Woche"
            value={
              form.sessionsPerWeekTarget != null ? String(form.sessionsPerWeekTarget) : ''
            }
            onChange={(event) =>
              setForm((f) => ({ ...f, sessionsPerWeekTarget: num(event.target.value) }))
            }
          />
          <NumberField
            label="Dauer (Wochen)"
            value={form.plannedWeeks != null ? String(form.plannedWeeks) : ''}
            onChange={(event) =>
              setForm((f) => ({ ...f, plannedWeeks: num(event.target.value) }))
            }
          />
        </div>

        <TextField
          label="Startdatum"
          type="date"
          value={form.startDate ?? ''}
          onChange={(event) => setForm((f) => ({ ...f, startDate: event.target.value }))}
        />

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Zielgewicht (kg)"
            value={form.targetBodyWeightKg != null ? String(form.targetBodyWeightKg) : ''}
            onChange={(event) =>
              setForm((f) => ({ ...f, targetBodyWeightKg: num(event.target.value) }))
            }
          />
          <NumberField
            label="Ziel-KFA (%)"
            value={
              form.targetBodyFatPercent != null ? String(form.targetBodyFatPercent) : ''
            }
            onChange={(event) =>
              setForm((f) => ({ ...f, targetBodyFatPercent: num(event.target.value) }))
            }
          />
        </div>

        <TextAreaField
          label="Fokus / Notiz"
          value={form.focusNote ?? ''}
          onChange={(event) => setForm((f) => ({ ...f, focusNote: event.target.value }))}
        />
        <TextAreaField
          label="Einschränkungen"
          value={form.restrictions ?? ''}
          placeholder="z. B. Verletzungen, fehlendes Equipment"
          onChange={(event) =>
            setForm((f) => ({ ...f, restrictions: event.target.value }))
          }
        />

        <p className="text-xs text-muted">
          Ziele sind Zielwerte, keine Messwerte. Sie werden nur angezeigt und nie als
          erreichte Werte gewertet.
        </p>
        <Button variant="primary" fullWidth onClick={() => void handleSave()}>
          Speichern
        </Button>
      </div>
    </Dialog>
  );
}
