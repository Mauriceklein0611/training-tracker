import { useMemo, useRef, useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { DurationField, NumberField } from '@/components/ui/Field';
import type { SessionExercise, WorkoutSet } from '@/types';
import {
  cardioSectionComplete,
  hasErrors,
  parseNumberInput,
  validateCardioSetInput,
  type CardioSetInputValues,
} from '@/services/validation';
import { effectiveSetExecution } from '@/services/equipment';
import { prefersMeters } from '@/services/cardio';
import { computePace, formatPace } from '@/services/cardioMetrics';
import { cn } from '@/utils/cn';
import { useAutosave } from '@/hooks/useAutosave';
import { useToast } from '@/hooks/useToast';
import { ExerciseTimer } from '@/features/session/ExerciseTimer';
import { useTranslation } from 'react-i18next';

/** The cardio values a completed section carries. */
export interface CardioSetValues {
  durationSeconds?: number;
  distanceMeters?: number;
  averageHeartRateBpm?: number;
  caloriesKcal?: number;
  elevationGainMeters?: number;
  cadenceRpm?: number;
  resistanceLevel?: number;
  rpe?: number;
}

interface Draft {
  duration: string;
  /** Entered in the modality's display unit (km, or m for rowing/swimming). */
  distance: string;
  rpe: string;
  heartRate: string;
  calories: string;
  elevation: string;
  cadence: string;
  resistance: string;
}

function toDraft(set: WorkoutSet, distanceInMeters: boolean): Draft {
  const distanceDisplay =
    set.distanceMeters == null
      ? ''
      : distanceInMeters
        ? String(set.distanceMeters)
        : String(set.distanceMeters / 1000);
  return {
    duration: set.durationSeconds == null ? '' : String(set.durationSeconds),
    distance: distanceDisplay,
    rpe: set.rpe == null ? '' : String(set.rpe),
    heartRate: set.averageHeartRateBpm == null ? '' : String(set.averageHeartRateBpm),
    calories: set.caloriesKcal == null ? '' : String(set.caloriesKcal),
    elevation: set.elevationGainMeters == null ? '' : String(set.elevationGainMeters),
    cadence: set.cadenceRpm == null ? '' : String(set.cadenceRpm),
    resistance: set.resistanceLevel == null ? '' : String(set.resistanceLevel),
  };
}

function num(raw: string): number | undefined {
  const parsed = parseNumberInput(raw);
  return parsed == null || Number.isNaN(parsed) ? undefined : parsed;
}

function draftToValues(draft: Draft, distanceInMeters: boolean): CardioSetValues {
  const rawDistance = num(draft.distance);
  return {
    durationSeconds: num(draft.duration),
    distanceMeters:
      rawDistance == null
        ? undefined
        : distanceInMeters
          ? rawDistance
          : rawDistance * 1000,
    rpe: num(draft.rpe),
    averageHeartRateBpm: num(draft.heartRate),
    caloriesKcal: num(draft.calories),
    elevationGainMeters: num(draft.elevation),
    cadenceRpm: num(draft.cadence),
    resistanceLevel: num(draft.resistance),
  };
}

/** Maps a cardio field error onto the input it belongs to. */
function fieldError(
  errors: ReturnType<typeof validateCardioSetInput>,
  touched: boolean,
  key: keyof CardioSetInputValues,
): string | undefined {
  return touched ? errors[key] : undefined;
}

/**
 * Entry row for the cardio section currently being performed.
 *
 * Mirrors the strength SetEditor's autosave and completion guards (values
 * survive a background/lock; a completed section is never overwritten by a
 * pending write; a double-tap completes only once) but shows cardio inputs:
 * a timer, duration, distance and RPE up front, the rest under "Weitere Werte".
 * No weight, reps, RIR or set-type fields.
 */
export function CardioSetEditor({
  set,
  sessionExercise,
  targetDurationSeconds,
  soundEnabled = true,
  vibrationEnabled = true,
  onPersist,
  onComplete,
  onDelete,
}: {
  set: WorkoutSet;
  sessionExercise: SessionExercise;
  targetDurationSeconds?: number;
  soundEnabled?: boolean;
  vibrationEnabled?: boolean;
  onPersist: (values: CardioSetValues) => void;
  onComplete: (values: CardioSetValues) => void | Promise<void>;
  onDelete: () => void;
}) {
  const { t } = useTranslation('session');
  const { t: tDomain } = useTranslation('domain');
  const toast = useToast();
  const execution = effectiveSetExecution(set, sessionExercise);
  const modality = execution.cardioModality;
  const distanceInMeters = prefersMeters(modality);
  const distanceUnit = distanceInMeters ? 'm' : 'km';

  const [draft, setDraft] = useState<Draft>(() => toDraft(set, distanceInMeters));
  const [touched, setTouched] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const completedRef = useRef(false);
  const completingRef = useRef(false);

  const autosave = useAutosave(
    draft,
    (current) => onPersist(draftToValues(current, distanceInMeters)),
    { delayMs: 400, enabled: !completedRef.current && !isCompleting },
  );

  const values = draftToValues(draft, distanceInMeters);
  const errors = useMemo(() => validateCardioSetInput(values), [values]);
  const canComplete = cardioSectionComplete(values) && !hasErrors(errors);

  // Live pace/speed from the values entered so far — shown only when both
  // duration and distance are present (never invented).
  const livePace = useMemo(
    () => computePace(modality, values.durationSeconds, values.distanceMeters),
    [modality, values.durationSeconds, values.distanceMeters],
  );
  const rpeValue = draft.rpe === '' ? null : Number(draft.rpe);

  const update = (key: keyof Draft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const persist = () => {
    if (completedRef.current) return;
    autosave.flush();
  };

  const runComplete = async (next: CardioSetValues) => {
    if (completingRef.current || completedRef.current) return;
    completingRef.current = true;
    setIsCompleting(true);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    autosave.cancel();
    try {
      await onComplete(next);
      completedRef.current = true;
      autosave.disable();
    } catch {
      toast.show(t('setEditor.cardioSaveFailed'), 'error');
    } finally {
      completingRef.current = false;
      setIsCompleting(false);
    }
  };

  const handleComplete = () => {
    setTouched(true);
    if (!cardioSectionComplete(values)) {
      toast.show(t('edit.cardioIncomplete'), 'error');
      return;
    }
    if (hasErrors(errors)) return;
    void runComplete(values);
  };

  return (
    <div className="rounded-2xl border border-accent/40 bg-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">
          Cardio · {tDomain(`cardioModality.${modality ?? 'other'}`)}
        </span>
        <IconButton label={t('setEditor.discardSection')} onClick={onDelete}>
          <Trash2 size={18} aria-hidden="true" />
        </IconButton>
      </div>

      {/* The timer feeds the duration; it stays editable by hand. */}
      <div className="mb-3">
        <ExerciseTimer
          setId={set.id}
          targetSeconds={targetDurationSeconds}
          soundEnabled={soundEnabled}
          vibrationEnabled={vibrationEnabled}
          // The timer only fills the duration; completing the cardio section is
          // the single "Abschnitt abschließen" action below (A7 — no double finish).
          showComplete={false}
          onApply={(seconds) => {
            setDraft((current) => ({ ...current, duration: String(seconds) }));
          }}
        />
      </div>

      <div className="grid gap-2">
        <DurationField
          label={t('field.duration')}
          value={values.durationSeconds}
          error={fieldError(errors, touched, 'durationSeconds')}
          onValueChange={(seconds) =>
            update('duration', seconds == null ? '' : String(seconds))
          }
          onCommit={persist}
        />
        <NumberField
          label={t('field.distance', { unit: distanceUnit })}
          decimal
          value={draft.distance}
          error={fieldError(errors, touched, 'distanceMeters')}
          onChange={(event) => update('distance', event.target.value)}
          onBlur={persist}
        />
      </div>

      {livePace ? (
        <p className="mt-2 text-sm text-muted">
          <span className="font-medium text-text">{t('field.pace')}: </span>
          <span className="numeric">{formatPace(livePace)}</span>
        </p>
      ) : null}

      <div className="mt-3">
        <span className="mb-1 block text-sm font-medium text-muted">
          {t('field.effort')} <span className="font-normal">({t('field.optional')})</span>
        </span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="RPE">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => {
            const active = rpeValue === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => update('rpe', active ? '' : String(value))}
                className={cn(
                  'min-h-[44px] min-w-[44px] rounded-xl border px-3 text-sm font-medium',
                  active
                    ? 'border-cardio bg-cardio/15 text-cardio'
                    : 'border-border bg-surface-2 text-text active:bg-surface-3',
                )}
              >
                {value}
              </button>
            );
          })}
        </div>
      </div>

      <details
        className="mt-2 rounded-xl bg-surface-3/40 p-2"
        open={moreOpen}
        onToggle={(event) => setMoreOpen((event.target as HTMLDetailsElement).open)}
      >
        <summary className="min-h-[44px] cursor-pointer list-none py-2 text-sm font-medium text-accent">
          {t('field.moreValues')}
        </summary>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <NumberField
            label={t('field.averageHeartRate')}
            value={draft.heartRate}
            error={fieldError(errors, touched, 'averageHeartRateBpm')}
            onChange={(event) => update('heartRate', event.target.value)}
            onBlur={persist}
          />
          <NumberField
            label={t('field.calories')}
            value={draft.calories}
            error={fieldError(errors, touched, 'caloriesKcal')}
            onChange={(event) => update('calories', event.target.value)}
            onBlur={persist}
          />
          <NumberField
            label={t('field.elevation')}
            value={draft.elevation}
            error={fieldError(errors, touched, 'elevationGainMeters')}
            onChange={(event) => update('elevation', event.target.value)}
            onBlur={persist}
          />
          <NumberField
            label={t('field.cadence')}
            value={draft.cadence}
            error={fieldError(errors, touched, 'cadenceRpm')}
            onChange={(event) => update('cadence', event.target.value)}
            onBlur={persist}
          />
          <NumberField
            label={t('field.resistance')}
            containerClassName="col-span-2"
            value={draft.resistance}
            error={fieldError(errors, touched, 'resistanceLevel')}
            onChange={(event) => update('resistance', event.target.value)}
            onBlur={persist}
          />
        </div>
      </details>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        className="mt-3"
        disabled={isCompleting || !canComplete}
        onClick={handleComplete}
      >
        <Check size={20} aria-hidden="true" />
        {isCompleting ? t('action.saving') : t('setEditor.completeSection')}
      </Button>
    </div>
  );
}
