import { useMemo, useRef, useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { NumberField } from '@/components/ui/Field';
import type { SessionExercise, WorkoutSet } from '@/types';
import {
  cardioSectionComplete,
  hasErrors,
  parseNumberInput,
  validateCardioSetInput,
  type CardioSetInputValues,
} from '@/services/validation';
import { effectiveSetExecution } from '@/services/equipment';
import { cardioModalityLabel, prefersMeters } from '@/services/cardio';
import { useAutosave } from '@/hooks/useAutosave';
import { useToast } from '@/hooks/useToast';
import { ExerciseTimer } from '@/features/session/ExerciseTimer';

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
    autosave.cancel();
    try {
      await onComplete(next);
      completedRef.current = true;
      autosave.disable();
    } catch {
      toast.show(
        'Der Cardio-Abschnitt konnte nicht gespeichert werden. Bitte erneut versuchen.',
        'error',
      );
    } finally {
      completingRef.current = false;
      setIsCompleting(false);
    }
  };

  const handleComplete = () => {
    setTouched(true);
    if (!cardioSectionComplete(values)) {
      toast.show('Bitte eine Dauer oder eine Distanz eingeben.', 'error');
      return;
    }
    if (hasErrors(errors)) return;
    void runComplete(values);
  };

  return (
    <div className="rounded-2xl border border-accent/40 bg-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">
          Cardio · {cardioModalityLabel(modality)}
        </span>
        <IconButton label="Abschnitt verwerfen" onClick={onDelete}>
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
          onApply={(seconds, { complete }) => {
            const nextDraft = { ...draft, duration: String(seconds) };
            setDraft(nextDraft);
            if (complete) {
              const next = draftToValues(nextDraft, distanceInMeters);
              setTouched(true);
              if (
                cardioSectionComplete(next) &&
                !hasErrors(validateCardioSetInput(next))
              ) {
                void runComplete(next);
              }
            }
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Dauer (s)"
          value={draft.duration}
          error={fieldError(errors, touched, 'durationSeconds')}
          onChange={(event) => update('duration', event.target.value)}
          onBlur={persist}
        />
        <NumberField
          label={`Distanz (${distanceUnit})`}
          decimal
          value={draft.distance}
          error={fieldError(errors, touched, 'distanceMeters')}
          onChange={(event) => update('distance', event.target.value)}
          onBlur={persist}
        />
        <NumberField
          label="RPE (optional)"
          decimal
          containerClassName="col-span-2"
          value={draft.rpe}
          error={fieldError(errors, touched, 'rpe')}
          onChange={(event) => update('rpe', event.target.value)}
          onBlur={persist}
        />
      </div>

      <details
        className="mt-2 rounded-xl bg-surface-3/40 p-2"
        open={moreOpen}
        onToggle={(event) => setMoreOpen((event.target as HTMLDetailsElement).open)}
      >
        <summary className="min-h-[44px] cursor-pointer list-none py-2 text-sm font-medium text-accent">
          Weitere Werte (optional)
        </summary>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <NumberField
            label="Ø Herzfrequenz (bpm)"
            value={draft.heartRate}
            error={fieldError(errors, touched, 'averageHeartRateBpm')}
            onChange={(event) => update('heartRate', event.target.value)}
            onBlur={persist}
          />
          <NumberField
            label="Kalorien (kcal)"
            value={draft.calories}
            error={fieldError(errors, touched, 'caloriesKcal')}
            onChange={(event) => update('calories', event.target.value)}
            onBlur={persist}
          />
          <NumberField
            label="Höhenmeter (m)"
            value={draft.elevation}
            error={fieldError(errors, touched, 'elevationGainMeters')}
            onChange={(event) => update('elevation', event.target.value)}
            onBlur={persist}
          />
          <NumberField
            label="Kadenz (rpm)"
            value={draft.cadence}
            error={fieldError(errors, touched, 'cadenceRpm')}
            onChange={(event) => update('cadence', event.target.value)}
            onBlur={persist}
          />
          <NumberField
            label="Widerstand"
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
        {isCompleting ? 'Wird gespeichert …' : 'Cardio abschließen'}
      </Button>
    </div>
  );
}
