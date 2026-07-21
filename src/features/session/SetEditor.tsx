import { useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { NumberField, SelectField } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Card';
import type { SessionExercise, SetType, WorkoutSet } from '@/types';
import { hasErrors, parseNumberInput, validateSetInput } from '@/services/validation';
import { requiredFieldsFor, weightFieldLabel } from '@/services/metrics';
import { restDeviationSeconds } from '@/services/rest';
import { SET_TYPE_LABELS, describeSet, formatSignedSeconds } from '@/utils/format';
import { cn } from '@/utils/cn';

interface Draft {
  setType: SetType;
  weight: string;
  reps: string;
  duration: string;
  rir: string;
  rpe: string;
}

function toDraft(set: WorkoutSet): Draft {
  return {
    setType: set.setType,
    weight: set.weightKg == null ? '' : String(set.weightKg),
    reps: set.reps == null ? '' : String(set.reps),
    duration: set.durationSeconds == null ? '' : String(set.durationSeconds),
    rir: set.rir == null ? '' : String(set.rir),
    rpe: set.rpe == null ? '' : String(set.rpe),
  };
}

export interface SetValues {
  setType: SetType;
  weightKg?: number;
  reps?: number;
  durationSeconds?: number;
  rir?: number;
  rpe?: number;
}

function draftToValues(draft: Draft): SetValues {
  const toNumber = (raw: string) => {
    const parsed = parseNumberInput(raw);
    return parsed == null || Number.isNaN(parsed) ? undefined : parsed;
  };
  return {
    setType: draft.setType,
    weightKg: toNumber(draft.weight),
    reps: toNumber(draft.reps),
    durationSeconds: toNumber(draft.duration),
    rir: toNumber(draft.rir),
    rpe: toNumber(draft.rpe),
  };
}

/**
 * Entry row for the set currently being performed.
 *
 * Values are kept in local state while typing and written to IndexedDB on blur
 * and on completion, so nothing is lost if the app is closed mid-set — but the
 * database is not hit on every keystroke either.
 */
export function SetEditor({
  set,
  sessionExercise,
  suggestion,
  onPersist,
  onComplete,
  onDelete,
}: {
  set: WorkoutSet;
  sessionExercise: SessionExercise;
  /** Values from the previous performance, shown as a hint above the fields. */
  suggestion?: string;
  onPersist: (values: SetValues) => void;
  onComplete: (values: SetValues) => void;
  onDelete: () => void;
}) {
  /*
   * The draft is seeded from the record once and then belongs to the user.
   * It is deliberately NOT re-synced from the live query: persisting on blur
   * triggers a new emission, and copying that back would overwrite whatever is
   * being typed at that moment. The parent remounts this component with a
   * `key` when a different set becomes current, which resets the draft.
   */
  const [draft, setDraft] = useState<Draft>(() => toDraft(set));
  const [touched, setTouched] = useState(false);

  const trackingType = sessionExercise.trackingTypeSnapshot;
  const weightMode = sessionExercise.weightModeSnapshot;
  const fields = requiredFieldsFor(trackingType);
  const weightLabel = weightFieldLabel(trackingType, weightMode);
  const showWeight = weightLabel != null;

  const values = draftToValues(draft);
  const errors = validateSetInput(values, trackingType, weightMode);
  const visibleErrors = touched ? errors : {};

  const update = (key: keyof Draft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const persist = () => onPersist(draftToValues(draft));

  const handleComplete = () => {
    setTouched(true);
    if (hasErrors(errors)) return;
    onComplete(draftToValues(draft));
  };

  return (
    <div className="rounded-2xl border border-accent/40 bg-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">Satz {set.position + 1}</span>
        <div className="flex items-center gap-1">
          <IconButton label={`Satz ${set.position + 1} verwerfen`} onClick={onDelete}>
            <Trash2 size={18} aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      {suggestion ? (
        <p className="mb-2 text-xs text-muted">
          Letztes Mal: <span className="font-medium text-text">{suggestion}</span>
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <SelectField
          label="Satzart"
          containerClassName="col-span-2"
          value={draft.setType}
          onChange={(event) => {
            const setType = event.target.value as SetType;
            setDraft((current) => ({ ...current, setType }));
            onPersist({ ...draftToValues(draft), setType });
          }}
        >
          {(Object.keys(SET_TYPE_LABELS) as SetType[]).map((type) => (
            <option key={type} value={type}>
              {SET_TYPE_LABELS[type]}
            </option>
          ))}
        </SelectField>

        {showWeight ? (
          <NumberField
            label={weightLabel}
            decimal
            value={draft.weight}
            error={visibleErrors.weightKg}
            onChange={(event) => update('weight', event.target.value)}
            onBlur={persist}
          />
        ) : null}

        {fields.reps ? (
          <NumberField
            label="Wiederholungen"
            value={draft.reps}
            error={visibleErrors.reps}
            onChange={(event) => update('reps', event.target.value)}
            onBlur={persist}
          />
        ) : null}

        {fields.duration ? (
          <NumberField
            label="Dauer (s)"
            value={draft.duration}
            error={visibleErrors.durationSeconds}
            onChange={(event) => update('duration', event.target.value)}
            onBlur={persist}
          />
        ) : null}

        <NumberField
          label="RIR (optional)"
          decimal
          value={draft.rir}
          error={visibleErrors.rir}
          onChange={(event) => update('rir', event.target.value)}
          onBlur={persist}
        />
        <NumberField
          label="RPE (optional)"
          decimal
          value={draft.rpe}
          error={visibleErrors.rpe}
          onChange={(event) => update('rpe', event.target.value)}
          onBlur={persist}
        />
      </div>

      <Button variant="primary" size="lg" fullWidth className="mt-3" onClick={handleComplete}>
        <Check size={20} aria-hidden="true" />
        Satz abschließen · Pause starten
      </Button>
    </div>
  );
}

/** Compact read-only representation of an already completed set. */
export function CompletedSetRow({
  set,
  sessionExercise,
  onEdit,
}: {
  set: WorkoutSet;
  sessionExercise: SessionExercise;
  onEdit?: () => void;
}) {
  const deviation = restDeviationSeconds(set);
  const content = (
    <>
      <span className="flex w-7 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-xs font-semibold">
        {set.position + 1}
      </span>
      <span className="numeric min-w-0 flex-1 truncate font-medium">
        {describeSet(set, sessionExercise.trackingTypeSnapshot, sessionExercise.weightModeSnapshot)}
      </span>
      {set.setType !== 'working' ? (
        <Badge tone={set.setType === 'warmup' ? 'default' : 'accent'}>
          {SET_TYPE_LABELS[set.setType]}
        </Badge>
      ) : null}
      {set.rir != null ? <span className="text-xs text-muted">RIR {set.rir}</span> : null}
      {deviation != null ? (
        <span
          className={cn(
            'numeric text-xs',
            deviation >= 0 ? 'text-muted' : 'text-warning',
          )}
          title="Abweichung von der Zielpause"
        >
          {formatSignedSeconds(deviation)}
        </span>
      ) : null}
    </>
  );

  if (!onEdit) {
    return (
      <div className="flex min-h-[44px] items-center gap-2 rounded-xl bg-surface-2 px-2 py-1.5">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Satz ${set.position + 1} bearbeiten`}
      className="flex min-h-[44px] w-full items-center gap-2 rounded-xl bg-surface-2 px-2 py-1.5 text-left active:bg-surface-3"
    >
      {content}
    </button>
  );
}
