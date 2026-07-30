import { useEffect, useId, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '@/db/db';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import {
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/ui/Field';
import { createExercise, updateExercise } from '@/db/repositories/exercises';
import { validateExerciseForm, parseNumberInput } from '@/services/validation';
import { allowedWeightModes, defaultWeightModeFor } from '@/services/exerciseRules';
import { normalizeMuscleQuery } from '@/constants/muscleGroups';
import { MuscleGroupChips } from '@/features/exercises/MuscleGroupChips';
import { MuscleGroupPicker } from '@/features/exercises/MuscleGroupPicker';
import { AnatomyBodyMap } from '@/features/muscles/AnatomyBodyMap';
import type {
  CardioModality,
  Equipment,
  Exercise,
  ProgressionMethod,
  TrackingType,
  WeightMode,
} from '@/types';
import { equipmentValuesFor } from '@/services/equipment';
import { CARDIO_MODALITY_VALUES, defaultEquipmentForModality } from '@/services/cardio';
import { TRACKING_TYPES } from '@/utils/format';
import { useToast } from '@/hooks/useToast';
import { exerciseDisplayName } from '@/utils/exerciseDisplay';

interface FormState {
  name: string;
  primaryMuscleGroup: string;
  secondaryMuscleGroups: string[];
  equipment: string;
  defaultEquipment: Equipment;
  trackingType: TrackingType;
  cardioModality: CardioModality;
  weightMode: WeightMode;
  weightMultiplier: string;
  defaultRestSeconds: string;
  weightIncrementKg: string;
  availableWeightsKg: string;
  progressionMethod: ProgressionMethod;
  targetRir: string;
  techniqueCues: string;
  alternativeExerciseIds: string[];
  notes: string;
}

/** Splits the cues textarea (one per line) into a clean, bounded array. */
function parseCues(raw: string): string[] | undefined {
  const cues = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
  return cues.length > 0 ? cues : undefined;
}

/** Parses an optional numeric field; out-of-range or empty yields undefined. */
function optionalNumber(
  raw: string,
  range: { min: number; max: number },
): number | undefined {
  const parsed = parseNumberInput(raw);
  if (parsed == null || Number.isNaN(parsed)) return undefined;
  if (parsed < range.min || parsed > range.max) return undefined;
  return parsed;
}

/** "10, 12.5, 15" → [10, 12.5, 15]; unusable entries are dropped. */
function parseWeightList(raw: string): number[] | undefined {
  const values = raw
    .split(',')
    .map((part) => parseNumberInput(part))
    .filter(
      (value): value is number => value != null && Number.isFinite(value) && value > 0,
    )
    .sort((a, b) => a - b);
  // Deduplicate, so a typo cannot produce two identical rack entries.
  const unique = [...new Set(values)];
  return unique.length > 0 ? unique : undefined;
}

function toFormState(
  exercise?: Exercise,
  defaultRest = 120,
  initialName = '',
): FormState {
  return {
    // A new exercise created straight from a search prefills the searched name;
    // an existing exercise always keeps its own name.
    name: exercise?.name ?? initialName.trim(),
    primaryMuscleGroup: exercise?.primaryMuscleGroup ?? '',
    secondaryMuscleGroups: exercise?.secondaryMuscleGroups ?? [],
    equipment: exercise?.equipment ?? '',
    defaultEquipment: exercise?.defaultEquipment ?? 'unspecified',
    trackingType: exercise?.trackingType ?? 'weight_reps',
    cardioModality: exercise?.cardioModality ?? 'running',
    weightMode: exercise?.weightMode ?? 'total',
    weightMultiplier: String(exercise?.weightMultiplier ?? 1),
    defaultRestSeconds: String(exercise?.defaultRestSeconds ?? defaultRest),
    weightIncrementKg:
      exercise?.weightIncrementKg == null ? '' : String(exercise.weightIncrementKg),
    availableWeightsKg: exercise?.availableWeightsKg?.join(', ') ?? '',
    progressionMethod: exercise?.progressionMethod ?? 'auto',
    targetRir: exercise?.targetRir == null ? '' : String(exercise.targetRir),
    techniqueCues: exercise?.techniqueCues?.join('\n') ?? '',
    alternativeExerciseIds: exercise?.alternativeExerciseIds ?? [],
    notes: exercise?.notes ?? '',
  };
}

/**
 * Create/edit form for an exercise.
 *
 * The weight convention drives every later calculation, so the form explains
 * each option inline instead of hiding it behind documentation.
 */
export function ExerciseFormDialog({
  open,
  exercise,
  existingNames,
  defaultRestSeconds = 120,
  initialName = '',
  onClose,
  onSaved,
}: {
  open: boolean;
  exercise?: Exercise;
  existingNames: string[];
  defaultRestSeconds?: number;
  /** Prefills the name for a brand-new exercise, e.g. from an unmatched search. */
  initialName?: string;
  onClose: () => void;
  onSaved?: (exercise: Exercise) => void;
}) {
  const { t, i18n } = useTranslation('more');
  const { t: tDomain } = useTranslation('domain');
  const toast = useToast();
  const listId = useId();
  const [form, setForm] = useState<FormState>(() =>
    toFormState(exercise, defaultRestSeconds, initialName),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [pickerMode, setPickerMode] = useState<'primary' | 'secondary' | null>(null);

  // Other exercises that can be picked as manual alternatives.
  const otherExercises = useLiveQuery(
    () =>
      db.exercises
        .filter((entry) => !entry.archived && entry.id !== exercise?.id)
        .toArray(),
    [exercise?.id],
    [],
  );

  useEffect(() => {
    if (open) {
      setForm(toFormState(exercise, defaultRestSeconds, initialName));
      setErrors({});
    }
  }, [open, exercise, defaultRestSeconds, initialName]);

  const isCardio = form.trackingType === 'cardio';
  const weightModes = useMemo(
    () => allowedWeightModes(form.trackingType),
    [form.trackingType],
  );
  const showMultiplier = !isCardio && form.weightMode === 'per_hand';
  const equipmentOptions = useMemo(
    () => equipmentValuesFor(form.trackingType),
    [form.trackingType],
  );

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleTrackingTypeChange = (trackingType: TrackingType) => {
    setForm((current) => {
      const allowed = allowedWeightModes(trackingType);
      const switchingToCardio = trackingType === 'cardio';
      const leavingCardio = current.trackingType === 'cardio' && !switchingToCardio;
      return {
        ...current,
        trackingType,
        // Keep the current convention if it still applies, otherwise fall back.
        weightMode: allowed.includes(current.weightMode)
          ? current.weightMode
          : defaultWeightModeFor(trackingType),
        // Cardio suggests its modality's device; leaving cardio clears the
        // (now inapplicable) cardio device rather than keeping a stale one.
        defaultEquipment: switchingToCardio
          ? defaultEquipmentForModality(current.cardioModality)
          : leavingCardio
            ? 'unspecified'
            : current.defaultEquipment,
      };
    });
  };

  const handleModalityChange = (cardioModality: CardioModality) => {
    setForm((current) => ({
      ...current,
      cardioModality,
      // Suggest — never force — the matching device for the chosen activity.
      defaultEquipment: defaultEquipmentForModality(cardioModality),
    }));
  };

  const handleSubmit = async () => {
    const multiplier = parseNumberInput(form.weightMultiplier) ?? 1;
    const rest = parseNumberInput(form.defaultRestSeconds) ?? 0;

    const validation = validateExerciseForm(
      {
        name: form.name,
        weightMultiplier: form.weightMode === 'per_hand' ? multiplier : 1,
        defaultRestSeconds: rest,
      },
      existingNames.filter(
        (name) => name.toLowerCase() !== (exercise?.name ?? '').toLowerCase(),
      ),
    );

    if (Object.keys(validation).length > 0) {
      setErrors(validation as Record<string, string>);
      return;
    }

    const primary = form.primaryMuscleGroup.trim();
    const payload = {
      name: form.name.trim(),
      primaryMuscleGroup: primary,
      // Defensive: keep non-empty, unique and never the primary group.
      secondaryMuscleGroups: [
        ...new Set(form.secondaryMuscleGroups.map((value) => value.trim())),
      ]
        .filter(Boolean)
        .filter((value) => normalizeMuscleQuery(value) !== normalizeMuscleQuery(primary)),
      equipment: form.equipment.trim(),
      // Optional structured equipment; "unspecified" stays undefined so an old
      // exercise is never given a guessed value just by being edited.
      defaultEquipment:
        form.defaultEquipment === 'unspecified' ? undefined : form.defaultEquipment,
      trackingType: form.trackingType,
      // The modality is only meaningful for cardio; cleared otherwise so a
      // strength exercise never carries a stray activity.
      cardioModality: form.trackingType === 'cardio' ? form.cardioModality : undefined,
      weightMode: form.weightMode,
      // The multiplier only has a meaning for the "per hand" convention.
      weightMultiplier: form.weightMode === 'per_hand' ? multiplier : 1,
      defaultRestSeconds: Math.round(rest),
      // Progression settings are optional: an empty field stays undefined
      // rather than being filled with a guessed default.
      weightIncrementKg: optionalNumber(form.weightIncrementKg, { min: 0.1, max: 100 }),
      availableWeightsKg: parseWeightList(form.availableWeightsKg),
      progressionMethod:
        form.progressionMethod === 'auto' ? undefined : form.progressionMethod,
      targetRir: optionalNumber(form.targetRir, { min: 0, max: 10 }),
      techniqueCues: parseCues(form.techniqueCues),
      alternativeExerciseIds:
        form.alternativeExerciseIds.length > 0 ? form.alternativeExerciseIds : undefined,
      notes: form.notes.trim(),
    };

    setSaving(true);
    try {
      if (exercise) {
        await updateExercise(exercise.id, payload);
        toast.show(t('screens.exercise.form.toast.saved'), 'success');
        onSaved?.({ ...exercise, ...payload });
      } else {
        const created = await createExercise(payload);
        toast.show(t('screens.exercise.form.toast.created'), 'success');
        onSaved?.(created);
      }
      onClose();
    } catch {
      toast.show(t('screens.exercise.form.toast.saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={
          exercise
            ? t('screens.exercise.form.editTitle')
            : t('screens.exercise.form.newTitle')
        }
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              {t('screens.action.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleSubmit()}
              disabled={saving}
            >
              {saving ? t('screens.action.saving') : t('screens.action.save')}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <TextField
            label={t('screens.exercise.form.name')}
            value={form.name}
            error={errors.name}
            autoComplete="off"
            placeholder={t('screens.exercise.form.namePlaceholder')}
            onChange={(event) => update('name', event.target.value)}
          />

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-sm font-medium">
                {t('screens.exercise.form.primaryMuscle')}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPickerMode('primary')}
              >
                {form.primaryMuscleGroup
                  ? t('screens.action.change')
                  : t('screens.action.choose')}
              </Button>
            </div>
            <MuscleGroupChips
              primary={form.primaryMuscleGroup || undefined}
              secondary={[]}
              onRemovePrimary={() => update('primaryMuscleGroup', '')}
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-sm font-medium">
                {t('screens.exercise.form.secondaryMuscles')}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPickerMode('secondary')}
              >
                {t('screens.action.add')}
              </Button>
            </div>
            <MuscleGroupChips
              secondary={form.secondaryMuscleGroups}
              onRemoveSecondary={(label) =>
                update(
                  'secondaryMuscleGroups',
                  form.secondaryMuscleGroups.filter((value) => value !== label),
                )
              }
            />
          </div>

          {form.primaryMuscleGroup || form.secondaryMuscleGroups.length > 0 ? (
            <div className="rounded-2xl border border-border bg-surface-2 p-3">
              <AnatomyBodyMap
                primary={form.primaryMuscleGroup ? [form.primaryMuscleGroup] : []}
                secondary={form.secondaryMuscleGroups}
              />
            </div>
          ) : null}

          <TextField
            label={t('screens.exercise.form.equipment')}
            value={form.equipment}
            list={`${listId}-equipment`}
            placeholder={t('screens.exercise.form.equipmentPlaceholder')}
            onChange={(event) => update('equipment', event.target.value)}
          />
          <datalist id={`${listId}-equipment`}>
            {equipmentOptions
              .filter((item) => item !== 'unspecified')
              .map((item) => (
                <option key={item} value={tDomain(`equipment.${item}`)} />
              ))}
          </datalist>

          <SelectField
            label={t('screens.exercise.form.trackingType')}
            value={form.trackingType}
            hint={tDomain(`trackingTypeHelp.${form.trackingType}`)}
            onChange={(event) =>
              handleTrackingTypeChange(event.target.value as TrackingType)
            }
          >
            {TRACKING_TYPES.map((type) => (
              <option key={type} value={type}>
                {tDomain(`trackingType.${type}`)}
              </option>
            ))}
          </SelectField>

          {isCardio ? (
            <SelectField
              label={t('screens.exercise.form.cardioModality')}
              value={form.cardioModality}
              hint={t('screens.exercise.form.cardioModalityHint')}
              onChange={(event) =>
                handleModalityChange(event.target.value as CardioModality)
              }
            >
              {CARDIO_MODALITY_VALUES.map((value) => (
                <option key={value} value={value}>
                  {tDomain(`cardioModality.${value}`)}
                </option>
              ))}
            </SelectField>
          ) : null}

          <SelectField
            label={
              isCardio
                ? t('screens.exercise.form.defaultCardioEquipment')
                : t('screens.exercise.form.defaultStrengthEquipment')
            }
            value={form.defaultEquipment}
            hint={t('screens.exercise.form.defaultEquipmentHint')}
            onChange={(event) =>
              update('defaultEquipment', event.target.value as Equipment)
            }
          >
            {equipmentOptions.map((value) => (
              <option key={value} value={value}>
                {tDomain(`equipment.${value}`)}
              </option>
            ))}
          </SelectField>

          {/* Weight convention and multiplier are meaningless for cardio. */}
          {!isCardio ? (
            <SelectField
              label={t('screens.exercise.form.weightMode')}
              value={form.weightMode}
              hint={tDomain(`weightModeHelp.${form.weightMode}`)}
              disabled={weightModes.length <= 1}
              onChange={(event) => update('weightMode', event.target.value as WeightMode)}
            >
              {weightModes.map((mode) => (
                <option key={mode} value={mode}>
                  {tDomain(`weightMode.${mode}`)}
                </option>
              ))}
            </SelectField>
          ) : null}

          {showMultiplier ? (
            <NumberField
              label={t('screens.exercise.form.weightMultiplier')}
              decimal
              value={form.weightMultiplier}
              error={errors.weightMultiplier}
              hint={t('screens.exercise.form.weightMultiplierHint')}
              onChange={(event) => update('weightMultiplier', event.target.value)}
            />
          ) : null}

          <NumberField
            label={
              isCardio
                ? t('screens.exercise.form.cardioRest')
                : t('screens.exercise.form.strengthRest')
            }
            value={form.defaultRestSeconds}
            error={errors.defaultRestSeconds}
            onChange={(event) => update('defaultRestSeconds', event.target.value)}
          />

          {/* Strength progression settings do not apply to cardio. */}
          {!isCardio ? (
            <details className="rounded-xl border border-border bg-surface-2 p-3">
              <summary className="min-h-[44px] cursor-pointer list-none py-2 text-sm font-medium text-accent">
                {t('screens.exercise.form.progression')}
              </summary>
              <div className="mt-3 grid gap-3">
                <p className="text-xs leading-relaxed text-muted">
                  {t('screens.exercise.form.progressionHint')}
                </p>

                <NumberField
                  label={t('screens.exercise.form.increment')}
                  decimal
                  value={form.weightIncrementKg}
                  placeholder={t('screens.exercise.form.incrementPlaceholder')}
                  onChange={(event) => update('weightIncrementKg', event.target.value)}
                />

                <TextField
                  label={t('screens.exercise.form.availableWeights')}
                  value={form.availableWeightsKg}
                  hint={t('screens.exercise.form.availableWeightsHint')}
                  onChange={(event) => update('availableWeightsKg', event.target.value)}
                />

                <SelectField
                  label={t('screens.exercise.form.progressionMethod')}
                  value={form.progressionMethod}
                  onChange={(event) =>
                    update('progressionMethod', event.target.value as ProgressionMethod)
                  }
                >
                  <option value="auto">
                    {t('screens.exercise.form.progressionMethods.auto')}
                  </option>
                  <option value="weight">
                    {t('screens.exercise.form.progressionMethods.weight')}
                  </option>
                  <option value="reps">
                    {t('screens.exercise.form.progressionMethods.reps')}
                  </option>
                </SelectField>

                <NumberField
                  label={t('screens.exercise.form.targetRir')}
                  decimal
                  value={form.targetRir}
                  hint={t('screens.exercise.form.targetRirHint')}
                  onChange={(event) => update('targetRir', event.target.value)}
                />
              </div>
            </details>
          ) : null}

          <TextAreaField
            label={t('screens.exercise.form.techniqueCues')}
            value={form.techniqueCues}
            hint={t('screens.exercise.form.techniqueCuesHint')}
            onChange={(event) => update('techniqueCues', event.target.value)}
          />

          {open && otherExercises.length > 0 ? (
            <details className="rounded-xl border border-border bg-surface-2 p-3">
              <summary className="min-h-[44px] cursor-pointer list-none py-2 text-sm font-medium text-accent">
                {t('screens.exercise.form.alternatives')}
                {form.alternativeExerciseIds.length > 0
                  ? ` · ${form.alternativeExerciseIds.length}`
                  : ''}
              </summary>
              <p className="mb-2 mt-1 text-xs leading-relaxed text-muted">
                {t('screens.exercise.form.alternativesHint')}
              </p>
              <div className="grid max-h-56 gap-1 overflow-y-auto">
                {[...otherExercises]
                  .sort((a, b) =>
                    exerciseDisplayName(a).localeCompare(
                      exerciseDisplayName(b),
                      i18n.resolvedLanguage,
                    ),
                  )
                  .map((entry) => {
                    const checked = form.alternativeExerciseIds.includes(entry.id);
                    return (
                      <label
                        key={entry.id}
                        className="flex items-center gap-2 py-1 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          className="h-5 w-5 accent-[var(--accent)]"
                          onChange={() =>
                            update(
                              'alternativeExerciseIds',
                              checked
                                ? form.alternativeExerciseIds.filter(
                                    (id) => id !== entry.id,
                                  )
                                : [...form.alternativeExerciseIds, entry.id],
                            )
                          }
                        />
                        <span className="min-w-0 truncate">
                          {exerciseDisplayName(entry)}
                        </span>
                      </label>
                    );
                  })}
              </div>
            </details>
          ) : null}

          <TextAreaField
            label={t('screens.exercise.form.notes')}
            value={form.notes}
            placeholder={t('screens.exercise.form.notesPlaceholder')}
            onChange={(event) => update('notes', event.target.value)}
          />
        </div>
      </Dialog>

      {pickerMode ? (
        <MuscleGroupPicker
          open
          mode={pickerMode === 'primary' ? 'single' : 'multiple'}
          title={
            pickerMode === 'primary'
              ? t('screens.exercise.form.primaryMuscle')
              : t('screens.exercise.form.secondaryMuscles')
          }
          selected={
            pickerMode === 'primary'
              ? form.primaryMuscleGroup
                ? [form.primaryMuscleGroup]
                : []
              : form.secondaryMuscleGroups
          }
          excludeLabels={
            pickerMode === 'secondary' && form.primaryMuscleGroup
              ? [form.primaryMuscleGroup]
              : []
          }
          onChange={(next) => {
            if (pickerMode === 'primary') {
              const label = next[0] ?? '';
              setForm((current) => ({
                ...current,
                primaryMuscleGroup: label,
                // A new primary can never remain in the secondary selection.
                secondaryMuscleGroups: current.secondaryMuscleGroups.filter(
                  (value) => normalizeMuscleQuery(value) !== normalizeMuscleQuery(label),
                ),
              }));
            } else {
              update('secondaryMuscleGroups', next);
            }
          }}
          onClose={() => setPickerMode(null)}
        />
      ) : null}
    </>
  );
}
