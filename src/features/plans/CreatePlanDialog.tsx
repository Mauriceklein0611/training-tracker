import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import {
  createPlan,
  PLAN_STRUCTURE_TEMPLATES,
  SPLIT_TYPE_DAY_COUNT,
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
  const { t } = useTranslation('plans');
  const { t: tCommon } = useTranslation();
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
      toast.show(t('create.nameRequired'), 'error');
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
    } catch {
      toast.show(t('create.failed'), 'error');
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
      title={t('create.title')}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            {tCommon('action.cancel')}
          </Button>
          <Button variant="primary" disabled={busy} onClick={() => void handleCreate()}>
            {t('create.create')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <TextField
          label={t('create.name')}
          value={name}
          placeholder={t('create.namePlaceholder')}
          onChange={(event) => setName(event.target.value)}
        />
        <SelectField
          label={t('create.structure')}
          hint={t('create.structureHint', {
            count: previewDayCount,
            days: t(previewDayCount === 1 ? 'create.dayOne' : 'create.dayOther'),
          })}
          value={structure}
          onChange={(event) => setStructure(event.target.value)}
        >
          <optgroup label={t('create.splitGroup')}>
            {SPLIT_OPTIONS.map((type) => (
              <option key={type} value={`split:${type}`}>
                {t(`split.${type}`)}
              </option>
            ))}
          </optgroup>
          <optgroup label={t('create.templatesGroup')}>
            {PLAN_STRUCTURE_TEMPLATES.filter((entry) => entry.id !== 'single').map(
              (entry) => (
                <option key={entry.id} value={`structure:${entry.id}`}>
                  {
                    (
                      t('create.structureTemplates', {
                        returnObjects: true,
                      }) as Record<string, string>
                    )[entry.id]
                  }
                </option>
              ),
            )}
          </optgroup>
        </SelectField>
        <TextAreaField
          label={t('create.description')}
          value={description}
          placeholder={t('create.optional')}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
    </Dialog>
  );
}
