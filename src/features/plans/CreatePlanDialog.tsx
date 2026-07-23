import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import {
  createPlan,
  PLAN_STRUCTURE_TEMPLATES,
  SPLIT_TYPE_DAY_COUNT,
  SPLIT_TYPE_LABELS,
} from '@/db/repositories/plans';
import type { PlanSplitType } from '@/types';
import { useToast } from '@/hooks/useToast';

/** Split presets offered first; "custom" starts with one freely-extendable day. */
const SPLIT_OPTIONS: PlanSplitType[] = [
  'single',
  '2-day',
  '3-day',
  '4-day',
  '5-day',
  'custom',
];

/**
 * Create a plan by choosing a structure. Two kinds are offered:
 *   - a split preset (single, 2–5 days, custom) → generic "Tag A/B/…", and
 *   - a named structure template (Push/Pull/Beine, …) → seeds only day *names*.
 * Neither ever adds exercises; the user fills the days afterwards.
 */
export function CreatePlanDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (planId: string) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // Value is `split:<type>` or `structure:<id>`.
  const [structure, setStructure] = useState('split:single');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName('');
    setDescription('');
    setStructure('split:single');
  };

  const previewDayCount = (() => {
    if (structure.startsWith('structure:')) {
      const found = PLAN_STRUCTURE_TEMPLATES.find(
        (entry) => entry.id === structure.slice('structure:'.length),
      );
      return found?.dayNames.length ?? 1;
    }
    return SPLIT_TYPE_DAY_COUNT[structure.slice('split:'.length) as PlanSplitType];
  })();

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.show('Bitte gib einen Namen ein.', 'error');
      return;
    }
    setBusy(true);
    try {
      let planId: string;
      if (structure.startsWith('structure:')) {
        const found = PLAN_STRUCTURE_TEMPLATES.find(
          (entry) => entry.id === structure.slice('structure:'.length),
        );
        const plan = await createPlan({
          name: trimmed,
          description,
          splitType: found?.splitType ?? 'custom',
          dayNames: found?.dayNames,
        });
        planId = plan.id;
      } else {
        const plan = await createPlan({
          name: trimmed,
          description,
          splitType: structure.slice('split:'.length) as PlanSplitType,
        });
        planId = plan.id;
      }
      reset();
      onCreated(planId);
    } catch (error) {
      toast.show(
        error instanceof Error ? error.message : 'Plan konnte nicht erstellt werden.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Neuer Trainingsplan"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Abbrechen
          </Button>
          <Button variant="primary" disabled={busy} onClick={() => void handleCreate()}>
            Erstellen
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <TextField
          label="Name"
          value={name}
          placeholder="z. B. Muskelaufbau"
          onChange={(event) => setName(event.target.value)}
        />
        <SelectField
          label="Struktur"
          hint={`Erzeugt ${previewDayCount} ${
            previewDayCount === 1 ? 'Trainingstag' : 'Trainingstage'
          } — Namen kannst du danach frei ändern. Es werden keine Übungen hinzugefügt.`}
          value={structure}
          onChange={(event) => setStructure(event.target.value)}
        >
          <optgroup label="Split">
            {SPLIT_OPTIONS.map((type) => (
              <option key={type} value={`split:${type}`}>
                {SPLIT_TYPE_LABELS[type]}
              </option>
            ))}
          </optgroup>
          <optgroup label="Vorlagen">
            {PLAN_STRUCTURE_TEMPLATES.filter((entry) => entry.id !== 'single').map(
              (entry) => (
                <option key={entry.id} value={`structure:${entry.id}`}>
                  {entry.label}
                </option>
              ),
            )}
          </optgroup>
        </SelectField>
        <TextAreaField
          label="Beschreibung"
          value={description}
          placeholder="Optional"
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
    </Dialog>
  );
}
