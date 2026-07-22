import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { TextAreaField } from '@/components/ui/Field';
import { CompletedSetRow, SetEditor, type SetValues } from '@/features/session/SetEditor';
import {
  addSet,
  completeSet,
  deleteSet,
  getLastPerformance,
  moveSessionExercise,
  removeSessionExercise,
  swapSessionExercise,
  updateSessionExercise,
  updateSet,
  type SessionExerciseDetail,
} from '@/db/repositories/sessions';
import { primeAudio } from '@/services/sound';
import { buildRecordBaseline } from '@/services/comparison';
import { suggestProgression } from '@/services/progression';
import { ProgressionHint } from '@/features/session/ProgressionHint';
import { db } from '@/db/db';
import { TRACKING_TYPE_LABELS, formatKg } from '@/utils/format';
import { formatDate } from '@/utils/date';
import type { TemplateExercise } from '@/types';

export interface ExerciseTarget {
  targetSets?: number;
  targetRepMin?: number;
  targetRepMax?: number;
  targetDurationSeconds?: number;
  restSeconds?: number;
}

function describeTarget(target: ExerciseTarget | undefined): string | null {
  if (!target) return null;
  const parts: string[] = [];
  if (target.targetSets) parts.push(`${target.targetSets} Sätze`);
  if (target.targetDurationSeconds) parts.push(`${target.targetDurationSeconds} s`);
  else if (target.targetRepMin && target.targetRepMax) {
    parts.push(`${target.targetRepMin}–${target.targetRepMax} Wdh.`);
  } else if (target.targetRepMin) parts.push(`ab ${target.targetRepMin} Wdh.`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * One exercise inside the running workout: previous performance, the sets
 * already completed, and the entry row for the next set.
 */
export function SessionExerciseCard({
  detail,
  sessionId,
  index,
  total,
  target,
  label,
  highlightNext,
  soundEnabled,
  vibrationEnabled,
}: {
  detail: SessionExerciseDetail;
  sessionId: string;
  index: number;
  total: number;
  /** Plan entry, used only for displaying the rep/duration target range. */
  target?: TemplateExercise;
  /** Position label, e.g. "A1" inside a superset. Defaults to "N.". */
  label?: string;
  /** Whether this is the exercise the group expects next. */
  highlightNext?: boolean;
  soundEnabled?: boolean;
  vibrationEnabled?: boolean;
}) {
  const { sessionExercise, sets } = detail;
  const [notesOpen, setNotesOpen] = useState(Boolean(sessionExercise.notes));
  const [notes, setNotes] = useState(sessionExercise.notes);

  const lastPerformance = useLiveQuery(
    () => getLastPerformance(sessionExercise.exerciseId, sessionId),
    [sessionExercise.exerciseId, sessionId],
  );

  const completedSets = useMemo(() => sets.filter((set) => set.completedAt), [sets]);
  const openSet = useMemo(() => sets.find((set) => !set.completedAt), [sets]);

  /*
   * The rest was resolved when the exercise entered this workout (plan target →
   * exercise default → global default) and stored on the record. Reading the
   * snapshot rather than re-resolving here is what stops a later edit of the
   * exercise from changing a workout that is already under way.
   */
  const restTarget = sessionExercise.restSecondsSnapshot;

  /*
   * Set goal. Only working sets count towards it — warm-ups are preparation,
   * not part of the prescription. Everything is derived from the stored sets,
   * so the state is correct after a reload or a restored session.
   */
  const targetSets = sessionExercise.targetSetsSnapshot;
  const completedWorkingSets = useMemo(
    () => sets.filter((set) => set.completedAt && set.setType !== 'warmup').length,
    [sets],
  );
  const setGoalReached = targetSets != null && completedWorkingSets >= targetSets;

  /** Prefill the next set from the previous one in this session, else from history. */
  const suggestionValues = useMemo(() => {
    const previous = completedSets[completedSets.length - 1];
    if (previous) {
      return {
        weightKg: previous.weightKg,
        reps: previous.reps,
        durationSeconds: previous.durationSeconds,
      };
    }
    const historic = lastPerformance?.sets.find((set) => set.setType === 'working');
    if (historic) {
      return {
        weightKg: historic.weightKg,
        reps: historic.reps,
        durationSeconds: historic.durationSeconds,
      };
    }
    return {};
  }, [completedSets, lastPerformance]);

  const previousSets = useMemo(() => lastPerformance?.sets ?? [], [lastPerformance]);

  /**
   * Best values recorded before this workout, for the "new best" badge.
   * Built from the previous performance only — the running workout must not
   * compete against itself.
   */
  const recordBaseline = useMemo(
    () => buildRecordBaseline(previousSets, sessionExercise),
    [previousSets, sessionExercise],
  );

  /** The exercise record, for its optional progression settings and cues. */
  const exercise = useLiveQuery(
    () => db.exercises.get(sessionExercise.exerciseId),
    [sessionExercise.exerciseId],
  );

  /** Manually configured alternative exercises, offered before any set is done. */
  const alternatives = useLiveQuery(async () => {
    const ids = exercise?.alternativeExerciseIds ?? [];
    if (ids.length === 0) return [];
    const rows = await db.exercises.bulkGet(ids);
    return rows.filter((row): row is NonNullable<typeof row> => row != null && !row.archived);
  }, [exercise?.alternativeExerciseIds]);

  /**
   * Suggestion for next time, derived from the *previous* workout.
   * Shown once this exercise is done for today, so it reads as a takeaway
   * rather than as instructions mid-set.
   */
  const progression = useMemo(() => {
    if (previousSets.length === 0) return null;
    return suggestProgression(previousSets, sessionExercise, {
      targetRepMin: target?.targetRepMin,
      targetRepMax: target?.targetRepMax,
      targetRir: exercise?.targetRir,
      weightIncrementKg: exercise?.weightIncrementKg,
      availableWeightsKg: exercise?.availableWeightsKg,
      progressionMethod: exercise?.progressionMethod,
    });
  }, [previousSets, sessionExercise, target, exercise]);

  /** Date line above the sets, so the comparison has a reference point. */
  const previousSessionLabel = useMemo(
    () =>
      lastPerformance ? `Letztes Training: ${formatDate(lastPerformance.session.startedAt)}` : null,
    [lastPerformance],
  );

  const handleAddSet = async () => {
    await addSet(sessionExercise.id, {
      setType: 'working',
      restTargetSeconds: restTarget,
      ...suggestionValues,
    });
  };

  const handleComplete = async (setId: string, values: SetValues) => {
    // Unlock audio from within the tap so the rest tone can play later on iOS.
    primeAudio();
    await completeSet(setId, values);

    // Would this set reach the goal? Warm-ups do not count towards it.
    const workingAfter = completedWorkingSets + (values.setType === 'warmup' ? 0 : 1);
    const reachedGoal = targetSets != null && workingAfter >= targetSets;

    // Queue the next set only while the goal is still open. Once it is met the
    // user decides explicitly whether to add an extra set, instead of the app
    // silently suggesting more work than the plan calls for.
    if (reachedGoal) return;

    await addSet(sessionExercise.id, {
      setType: values.setType === 'warmup' ? 'warmup' : 'working',
      restTargetSeconds: restTarget,
      weightKg: values.weightKg,
      reps: values.reps,
      durationSeconds: values.durationSeconds,
    });
  };

  return (
    <section
      aria-labelledby={`exercise-${sessionExercise.id}`}
      className={`rounded-2xl border bg-surface p-3 ${
        highlightNext ? 'border-accent ring-1 ring-accent' : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id={`exercise-${sessionExercise.id}`} className="font-semibold leading-tight">
            <span className="text-muted">{label ?? `${index + 1}.`} </span>
            {sessionExercise.exerciseNameSnapshot}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            {highlightNext ? <Badge tone="accent">Als Nächstes</Badge> : null}
            <Badge>{TRACKING_TYPE_LABELS[sessionExercise.trackingTypeSnapshot]}</Badge>
            {describeTarget(target) ? <span>Ziel: {describeTarget(target)}</span> : null}
            <span>Pause {restTarget}s</span>
            {sessionExercise.weightModeSnapshot === 'per_hand' ? (
              <span>je Hand ×{sessionExercise.weightMultiplierSnapshot}</span>
            ) : null}
            {previousSessionLabel ? <span>{previousSessionLabel}</span> : null}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <IconButton
            label={`${sessionExercise.exerciseNameSnapshot} nach oben`}
            disabled={index === 0}
            onClick={() => void moveSessionExercise(sessionExercise.id, -1)}
          >
            <ArrowUp size={18} aria-hidden="true" />
          </IconButton>
          <IconButton
            label={`${sessionExercise.exerciseNameSnapshot} nach unten`}
            disabled={index === total - 1}
            onClick={() => void moveSessionExercise(sessionExercise.id, 1)}
          >
            <ArrowDown size={18} aria-hidden="true" />
          </IconButton>
          <IconButton
            label={`${sessionExercise.exerciseNameSnapshot} aus dem Training entfernen`}
            onClick={() => void removeSessionExercise(sessionExercise.id)}
          >
            <Trash2 size={18} aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      {exercise?.techniqueCues && exercise.techniqueCues.length > 0 ? (
        <ul className="mt-2 grid gap-1 rounded-xl bg-surface-2 p-2 text-xs text-muted">
          {exercise.techniqueCues.map((cue, index) => (
            <li key={index} className="flex gap-1.5">
              <span aria-hidden="true" className="text-accent">
                •
              </span>
              <span>{cue}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Swapping is only offered before any set is recorded — the sets belong
          to the current exercise and would otherwise be lost. */}
      {completedSets.length === 0 && (alternatives?.length ?? 0) > 0 ? (
        <details className="mt-2">
          <summary className="min-h-[44px] cursor-pointer list-none py-2 text-sm font-medium text-accent">
            Alternative wählen ({alternatives?.length})
          </summary>
          <div className="mt-1 flex flex-wrap gap-2">
            {alternatives?.map((alternative) => (
              <Button
                key={alternative.id}
                variant="secondary"
                size="sm"
                onClick={() => void swapSessionExercise(sessionExercise.id, alternative)}
              >
                {alternative.name}
              </Button>
            ))}
          </div>
        </details>
      ) : null}

      {completedSets.length > 0 ? (
        <ul className="mt-3 grid gap-1">
          {completedSets.map((set) => (
            <li key={set.id}>
              <CompletedSetRow set={set} sessionExercise={sessionExercise} />
            </li>
          ))}
        </ul>
      ) : null}

      {sessionExercise.weightModeSnapshot === 'per_hand' && completedSets.length > 0 ? (
        <p className="mt-2 text-xs text-muted">
          Gesamtlast letzter Satz:{' '}
          {formatKg(
            (completedSets[completedSets.length - 1].weightKg ?? 0) *
              sessionExercise.weightMultiplierSnapshot,
          )}
        </p>
      ) : null}

      <div className="mt-3">
        {openSet ? (
          <SetEditor
            // Remounting on a new set id resets the draft exactly once.
            key={openSet.id}
            set={openSet}
            sessionExercise={sessionExercise}
            previousSets={previousSets}
            sessionSets={sets}
            recordBaseline={recordBaseline}
            targetDurationSeconds={target?.targetDurationSeconds}
            soundEnabled={soundEnabled}
            vibrationEnabled={vibrationEnabled}
            onPersist={(values) => void updateSet(openSet.id, values)}
            onComplete={(values) => void handleComplete(openSet.id, values)}
            onDelete={() => void deleteSet(openSet.id)}
          />
        ) : setGoalReached ? (
          // Goal met: state it calmly and let the user opt into more work.
          <div className="grid gap-2">
            <p className="flex items-center justify-center gap-2 rounded-xl bg-surface-2 py-2 text-sm font-medium text-success">
              <Check size={16} aria-hidden="true" />
              Satzziel erreicht ({completedWorkingSets} von {targetSets})
            </p>
            <Button variant="secondary" fullWidth onClick={() => void handleAddSet()}>
              <Plus size={18} aria-hidden="true" />
              Extrasatz hinzufügen
            </Button>
          </div>
        ) : (
          <Button variant="secondary" fullWidth onClick={() => void handleAddSet()}>
            <Plus size={18} aria-hidden="true" />
            {completedSets.length === 0 ? 'Ersten Satz erfassen' : 'Weiteren Satz erfassen'}
          </Button>
        )}
      </div>

      {/* Only once the work is done for today — not while entering sets. */}
      {progression && setGoalReached && !openSet ? (
        <ProgressionHint suggestion={progression} />
      ) : null}

      <div className="mt-3">
        {notesOpen ? (
          <TextAreaField
            label="Notiz zur Übung"
            value={notes}
            rows={2}
            placeholder="z. B. Griff enger, linke Schulter zwickt"
            onChange={(event) => setNotes(event.target.value)}
            onBlur={() => void updateSessionExercise(sessionExercise.id, { notes })}
          />
        ) : (
          <button
            type="button"
            onClick={() => setNotesOpen(true)}
            className="min-h-[44px] text-sm font-medium text-accent"
          >
            + Notiz hinzufügen
          </button>
        )}
      </div>
    </section>
  );
}
