import { useMemo, useRef, useState } from 'react';
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
import { useAutosave } from '@/hooks/useAutosave';
import { ExerciseTimer } from '@/features/session/ExerciseTimer';
import {
  compareSet,
  findPreviousSetForComparison,
  type RecordBaseline,
} from '@/services/comparison';

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
 * Values live in local state while typing and are persisted by a debounced
 * autosave (plus immediately on blur, on completion, and whenever the app is
 * about to be hidden). Half-entered numbers therefore survive switching apps or
 * locking the phone, without hitting IndexedDB on every keystroke.
 */
export function SetEditor({
  set,
  sessionExercise,
  previousSets,
  sessionSets,
  recordBaseline,
  onPersist,
  onComplete,
  onDelete,
  targetDurationSeconds,
  soundEnabled = true,
  vibrationEnabled = true,
}: {
  set: WorkoutSet;
  sessionExercise: SessionExercise;
  /** Completed sets of the previous workout for this exercise. */
  previousSets: WorkoutSet[];
  /** All sets of this exercise in the running workout. */
  sessionSets: WorkoutSet[];
  /** Best values recorded before this workout. */
  recordBaseline: RecordBaseline;
  onPersist: (values: SetValues) => void;
  onComplete: (values: SetValues) => void;
  onDelete: () => void;
  /** Plan target duration, prefilled as the countdown. */
  targetDurationSeconds?: number;
  soundEnabled?: boolean;
  vibrationEnabled?: boolean;
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

  /*
   * Once the set is completed the draft must never be written again: a pending
   * autosave firing afterwards would overwrite the finished set with older
   * values. The ref flips synchronously inside the completion handler, before
   * any re-render can schedule another write.
   */
  const completedRef = useRef(false);

  const autosave = useAutosave(
    draft,
    (current) => onPersist(draftToValues(current)),
    { delayMs: 400, enabled: !completedRef.current },
  );

  const trackingType = sessionExercise.trackingTypeSnapshot;
  const weightMode = sessionExercise.weightModeSnapshot;
  const fields = requiredFieldsFor(trackingType);
  const weightLabel = weightFieldLabel(trackingType, weightMode);
  const showWeight = weightLabel != null;

  const values = draftToValues(draft);
  const errors = validateSetInput(values, trackingType, weightMode);
  const visibleErrors = touched ? errors : {};

  /*
   * Which set of the previous workout this one corresponds to: the nth set of
   * the same type. Recomputed as the draft changes, so switching a set to
   * "warm-up" immediately compares against warm-ups instead.
   */
  const ordinalWithinType = useMemo(
    () =>
      sessionSets.filter((entry) => entry.completedAt && entry.setType === draft.setType).length,
    [sessionSets, draft.setType],
  );

  const comparison = useMemo(() => {
    const match = findPreviousSetForComparison(previousSets, {
      setType: draft.setType,
      ordinalWithinType,
    });
    if (!match) return null;
    return compareSet(draftToValues(draft), match, sessionExercise, recordBaseline);
  }, [previousSets, draft, ordinalWithinType, sessionExercise, recordBaseline]);

  const update = (key: keyof Draft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  /** Blur still writes straight away — no reason to wait for the debounce. */
  const persist = () => {
    if (completedRef.current) return;
    autosave.flush();
  };

  const handleComplete = () => {
    setTouched(true);
    if (hasErrors(errors)) return;

    // Drop any pending autosave and block further ones, so the completion
    // write is the last thing that touches this set.
    completedRef.current = true;
    autosave.disable();
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

      {/*
       * Comparison with the same set of the previous workout. Read-only, and
       * silent when there is nothing comparable — an empty line beats a
       * misleading one.
       */}
      {comparison ? (
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="text-muted">
            {comparison.matchedBy === 'same-position' ? 'Letztes Mal' : 'Zuletzt'}:
          </span>
          <span className="numeric font-medium">{comparison.previousSummary}</span>

          {comparison.deltas.map((delta) => (
            <span
              key={delta.label}
              className={cn(
                'numeric rounded-full px-1.5 py-0.5 font-semibold',
                delta.direction === 'better'
                  ? 'bg-surface-3 text-success'
                  : 'bg-surface-3 text-warning',
              )}
            >
              {/* Arrow so the direction is not carried by colour alone. */}
              <span aria-hidden="true">{delta.direction === 'better' ? '▲ ' : '▼ '}</span>
              {delta.label}
            </span>
          ))}

          {comparison.isRecord ? (
            <span className="rounded-full bg-surface-3 px-1.5 py-0.5 font-semibold text-accent">
              ★ Neuer Bestwert
            </span>
          ) : null}

          {comparison.matchedBy === 'last-working-set' ? (
            <span className="text-muted">(letzter Arbeitssatz)</span>
          ) : null}
        </div>
      ) : null}

      {/* Time-based exercises get a timer; the duration field stays editable. */}
      {trackingType === 'duration' ? (
        <div className="mb-3">
          <ExerciseTimer
            setId={set.id}
            targetSeconds={targetDurationSeconds}
            soundEnabled={soundEnabled}
            vibrationEnabled={vibrationEnabled}
            onApply={(seconds, { complete }) => {
              const next = { ...draft, duration: String(seconds) };
              setDraft(next);
              if (complete) {
                completedRef.current = true;
                autosave.disable();
                onComplete(draftToValues(next));
              }
            }}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <SelectField
          label="Satzart"
          containerClassName="col-span-2"
          value={draft.setType}
          onChange={(event) => {
            // Autosave picks this up; calling onPersist here would write a
            // draft captured before setDraft applied.
            const setType = event.target.value as SetType;
            setDraft((current) => ({ ...current, setType }));
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
