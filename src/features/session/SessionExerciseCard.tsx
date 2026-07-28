import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDown, ArrowUp, Check, Plus, Repeat, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { TextAreaField } from '@/components/ui/Field';
import { CompletedSetRow, SetEditor, type SetValues } from '@/features/session/SetEditor';
import {
  CardioSetEditor,
  type CardioSetValues,
} from '@/features/session/CardioSetEditor';
import { ExecutionChangeDialog } from '@/features/session/ExecutionChangeDialog';
import { EditSetDialog } from '@/features/session/EditSetDialog';
import {
  effectiveSetExecution,
  equipmentLabel,
  executionKey,
  setExecutionKey,
} from '@/services/equipment';
import {
  addSet,
  completeSet,
  reopenSet,
  deleteSet,
  getExerciseHistorySets,
  getLastPerformance,
  moveSessionExercise,
  removeSessionExercise,
  swapSessionExercise,
  updateSessionExercise,
  updateSet,
  type SessionExerciseDetail,
} from '@/db/repositories/sessions';
import { primeAudio } from '@/services/sound';
import { useToast } from '@/hooks/useToast';
import { effectiveLoadKg, isWorkingSet } from '@/services/metrics';
import { formatCardioDistance, formatDuration } from '@/services/cardioMetrics';
import { buildRecordBaseline } from '@/services/comparison';
import { resolveEffectiveTarget } from '@/services/sessionTargets';
import { suggestProgression } from '@/services/progression';
import { ProgressionHint } from '@/features/session/ProgressionHint';
import { db } from '@/db/db';
import { TRACKING_TYPE_LABELS, formatKg } from '@/utils/format';
import { formatDate } from '@/utils/date';
import type { EffortInput, SessionExercise, TemplateExercise, WorkoutSet } from '@/types';

export interface ExerciseTarget {
  targetSets?: number;
  targetRepMin?: number;
  targetRepMax?: number;
  targetDurationSeconds?: number;
  targetDistanceMeters?: number;
  targetRpe?: number;
  restSeconds?: number;
}

function describeTarget(
  target: ExerciseTarget | undefined,
  isCardio: boolean,
): string | null {
  if (!target) return null;
  const parts: string[] = [];
  if (isCardio) {
    if (target.targetSets && target.targetSets > 1) {
      parts.push(`${target.targetSets} Intervalle`);
    }
    if (target.targetDurationSeconds) {
      parts.push(formatDuration(target.targetDurationSeconds));
    }
    if (target.targetDistanceMeters) {
      parts.push(formatCardioDistance(target.targetDistanceMeters, undefined));
    }
    if (target.targetRpe) parts.push(`RPE ${target.targetRpe}`);
    return parts.length > 0 ? parts.join(' · ') : null;
  }
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
  effortInput,
  expertLabels,
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
  /** Effort metric preference passed to the strength set editor. */
  effortInput?: EffortInput;
  /** Compact effort labels for experienced users. */
  expertLabels?: boolean;
}) {
  const { sessionExercise, sets } = detail;
  const toast = useToast();

  /*
   * Targets come first from this session-exercise's own frozen snapshots (see
   * resolveEffectiveTarget), so a later plan edit cannot change a running
   * workout and the same exercise at two positions keeps its own targets. Older
   * (v14) active workouts fall back field-wise to the plan lookup.
   */
  const effectiveTarget: ExerciseTarget | undefined = useMemo(
    () => resolveEffectiveTarget(sessionExercise, target),
    [sessionExercise, target],
  );

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

  /**
   * The execution the *next* set will be performed with — the current
   * session-exercise snapshot (a still-open/new set inherits it).
   */
  const currentExecutionKey = useMemo(
    () =>
      executionKey(
        sessionExercise.exerciseId,
        effectiveSetExecution({}, sessionExercise),
      ),
    [sessionExercise],
  );

  /**
   * Prefill the next set. The weight is only carried over from a set performed
   * with the *same* execution (see {@link executionKey}); after a temporary
   * switch — e.g. barbell 40 kg total → dumbbells per hand — a raw 40 must not be
   * pre-filled as 40 per hand, so the weight is left empty until the user types
   * it. Repetitions/duration carry over only for the same tracking type.
   */
  const suggestionValues = useMemo(() => {
    const sameExecution = (set: WorkoutSet, context: SessionExercise) =>
      setExecutionKey(sessionExercise.exerciseId, set, context) === currentExecutionKey;

    // Last completed set of this session with the same execution.
    const sessionMatch = [...completedSets]
      .reverse()
      .find((set) => sameExecution(set, sessionExercise));
    if (sessionMatch) {
      return {
        weightKg: sessionMatch.weightKg,
        reps: sessionMatch.reps,
        durationSeconds: sessionMatch.durationSeconds,
      };
    }

    // Otherwise the most recent historic working set with the same execution
    // (evaluated with the previous workout's own context).
    const previousContext = lastPerformance?.sessionExercise;
    const historic = previousContext
      ? [...(lastPerformance?.sets ?? [])]
          .reverse()
          .find((set) => set.setType === 'working' && sameExecution(set, previousContext))
      : undefined;
    if (historic) {
      return {
        weightKg: historic.weightKg,
        reps: historic.reps,
        durationSeconds: historic.durationSeconds,
      };
    }

    // No comparable execution: leave the weight empty rather than guessing.
    // Reps/duration still carry from the last set of this session when the
    // tracking type matches, since a rep count survives a weight change.
    const lastAny = completedSets[completedSets.length - 1];
    if (
      lastAny &&
      effectiveSetExecution(lastAny, sessionExercise).trackingType ===
        sessionExercise.trackingTypeSnapshot
    ) {
      return { reps: lastAny.reps, durationSeconds: lastAny.durationSeconds };
    }
    return {};
  }, [completedSets, lastPerformance, sessionExercise, currentExecutionKey]);

  const previousSets = useMemo(() => lastPerformance?.sets ?? [], [lastPerformance]);

  /**
   * Total load of the last completed set, using *that set's own* execution
   * snapshot (not the possibly-changed session-exercise context). Only shown for
   * per-hand work where a total load is meaningful; `effectiveLoadKg` returns
   * null for every other mode, so nothing misleading is displayed.
   */
  const lastSetTotalLoadKg = useMemo(() => {
    const last = completedSets[completedSets.length - 1];
    if (!last) return null;
    const execution = effectiveSetExecution(last, sessionExercise);
    if (execution.weightMode !== 'per_hand') return null;
    return effectiveLoadKg(last, sessionExercise);
  }, [completedSets, sessionExercise]);

  /**
   * Every completed set of this exercise before the running workout. This is the
   * real "personal best" baseline — an older record correctly counts, and the
   * current workout never competes against itself (the current session is
   * excluded).
   */
  const historySets = useLiveQuery(
    () => getExerciseHistorySets(sessionExercise.exerciseId, sessionId),
    [sessionExercise.exerciseId, sessionId],
    [],
  );

  /**
   * The "new best" baseline is built only from history performed with the *same*
   * execution as the set being entered, so a dumbbell best never competes
   * against a barbell one. A single-execution history keeps every set, unchanged.
   */
  const recordBaseline = useMemo(
    () =>
      buildRecordBaseline(
        historySets.filter(
          ({ set, context }) =>
            setExecutionKey(context.exerciseId, set, context) === currentExecutionKey,
        ),
      ),
    [historySets, currentExecutionKey],
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
    return rows.filter(
      (row): row is NonNullable<typeof row> => row != null && !row.archived,
    );
  }, [exercise?.alternativeExerciseIds]);

  /**
   * Suggestion for next time, derived from the working sets *just completed in
   * this workout* (warm-ups excluded). Shown once the exercise is done for
   * today, so it reads as a takeaway rather than as instructions mid-set.
   */
  const progression = useMemo(() => {
    // Only sets performed with the current execution are comparable; a temporary
    // switch within the exercise must not mix e.g. barbell and dumbbell sets into
    // one recommendation (see executionKey).
    const currentWorkingSets = sets.filter(
      (set) =>
        set.completedAt &&
        isWorkingSet(set) &&
        setExecutionKey(sessionExercise.exerciseId, set, sessionExercise) ===
          currentExecutionKey,
    );
    if (currentWorkingSets.length === 0) return null;
    return suggestProgression(currentWorkingSets, sessionExercise, {
      targetRepMin: effectiveTarget?.targetRepMin,
      targetRepMax: effectiveTarget?.targetRepMax,
      targetRir: exercise?.targetRir,
      weightIncrementKg: exercise?.weightIncrementKg,
      availableWeightsKg: exercise?.availableWeightsKg,
      progressionMethod: exercise?.progressionMethod,
    });
  }, [sets, sessionExercise, effectiveTarget, exercise, currentExecutionKey]);

  /** Date line above the sets, so the comparison has a reference point. */
  const previousSessionLabel = useMemo(
    () =>
      lastPerformance
        ? `Letztes Training: ${formatDate(lastPerformance.session.startedAt)}`
        : null,
    [lastPerformance],
  );

  const [isAdding, setIsAdding] = useState(false);
  const [executionOpen, setExecutionOpen] = useState(false);
  const [editSet, setEditSet] = useState<WorkoutSet | null>(null);

  /**
   * The execution currently active for this exercise in this workout, and whether
   * it differs from the stored exercise default (i.e. a temporary switch). The
   * badge makes a taken-barbell dumbbell substitution visible without changing
   * the exercise itself.
   */
  const currentExecution = useMemo(
    () => effectiveSetExecution({}, sessionExercise),
    [sessionExercise],
  );
  const isCardio = currentExecution.trackingType === 'cardio';
  // A pause is only meaningful for strength sets and for interval cardio (more
  // than one planned section). Continuous free cardio shows no interval pause
  // and never starts a rest timer (A8).
  const isIntervalCardio = isCardio && targetSets != null && targetSets > 1;
  const showRest = restTarget > 0 && (!isCardio || isIntervalCardio);
  const isTemporaryExecution = useMemo(() => {
    if (!exercise) return currentExecution.equipment !== 'unspecified';
    return (
      currentExecution.equipment !== (exercise.defaultEquipment ?? 'unspecified') ||
      currentExecution.weightMode !== exercise.weightMode
    );
  }, [exercise, currentExecution]);
  const showExecutionBadge =
    currentExecution.equipment !== 'unspecified' || isTemporaryExecution;

  const handleAddSet = async () => {
    if (isAdding) return;
    setIsAdding(true);
    try {
      await addSet(sessionExercise.id, {
        setType: 'working',
        restTargetSeconds: restTarget,
        ...suggestionValues,
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleComplete = async (setId: string, values: SetValues) => {
    // Unlock audio from within the tap so the rest tone can play later on iOS.
    primeAudio();
    const { newlyCompleted } = await completeSet(setId, values);
    // A double / racing tap that did not actually complete the set must not
    // queue another set — otherwise two "next" drafts would appear.
    if (!newlyCompleted) return;

    // Time-limited undo: reopening clears the completion and any rest it started,
    // keeping the entered values, so a mistap is fully reversible and data-safe.
    toast.show('Satz erfasst.', 'success', {
      durationMs: 6000,
      action: {
        label: 'Rückgängig',
        onClick: () => void reopenSet(setId),
      },
    });

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

  const handleCompleteCardio = async (setId: string, values: CardioSetValues) => {
    primeAudio();
    const workingAfter = completedWorkingSets + 1;
    const reachedGoal = targetSets != null && workingAfter >= targetSets;
    // A continuous cardio (no further interval) starts no strength rest; a
    // planned interval with another to go and a rest target uses the timer.
    const startRest =
      !reachedGoal && targetSets != null && targetSets > 1 && restTarget > 0;

    const { newlyCompleted } = await completeSet(setId, values, { startRest });
    if (!newlyCompleted) return;
    if (reachedGoal) return;

    // Only queue a next interval when the plan calls for more than one.
    if (targetSets != null && targetSets > 1) {
      await addSet(sessionExercise.id, { restTargetSeconds: restTarget });
    }
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
          <h2
            id={`exercise-${sessionExercise.id}`}
            className="font-semibold leading-tight"
          >
            <span className="text-muted">{label ?? `${index + 1}.`} </span>
            {sessionExercise.exerciseNameSnapshot}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            {highlightNext ? <Badge tone="accent">Als Nächstes</Badge> : null}
            <Badge>{TRACKING_TYPE_LABELS[sessionExercise.trackingTypeSnapshot]}</Badge>
            {describeTarget(effectiveTarget, isCardio) ? (
              <span>Ziel: {describeTarget(effectiveTarget, isCardio)}</span>
            ) : null}
            {showRest ? <span>Pause {restTarget}s</span> : null}
            {showExecutionBadge ? (
              <Badge tone={isTemporaryExecution ? 'accent' : 'default'}>
                {equipmentLabel(currentExecution.equipment)}
                {currentExecution.weightMode === 'per_hand'
                  ? ` · pro Hantel ×${currentExecution.weightMultiplier}`
                  : ''}
                {isTemporaryExecution ? ' · nur dieses Training' : ''}
              </Badge>
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

      {/* Temporary execution switch (e.g. barbell taken → dumbbells). Only for
          weighted exercises, where the equipment/convention actually matters. */}
      {sessionExercise.trackingTypeSnapshot === 'weight_reps' ? (
        <button
          type="button"
          onClick={() => setExecutionOpen(true)}
          className="mt-2 flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-accent"
        >
          <Repeat size={16} aria-hidden="true" />
          Ausführung ändern
        </button>
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
              <CompletedSetRow
                set={set}
                sessionExercise={sessionExercise}
                onEdit={() => setEditSet(set)}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {lastSetTotalLoadKg != null ? (
        <p className="mt-2 text-xs text-muted">
          Gesamtlast letzter Satz: {formatKg(lastSetTotalLoadKg)}
        </p>
      ) : null}

      <div className="mt-3">
        {openSet && isCardio ? (
          <CardioSetEditor
            key={openSet.id}
            set={openSet}
            sessionExercise={sessionExercise}
            targetDurationSeconds={effectiveTarget?.targetDurationSeconds}
            soundEnabled={soundEnabled}
            vibrationEnabled={vibrationEnabled}
            onPersist={(values) => void updateSet(openSet.id, values)}
            onComplete={(values) => handleCompleteCardio(openSet.id, values)}
            onDelete={() => void deleteSet(openSet.id)}
          />
        ) : openSet ? (
          <SetEditor
            effortInput={effortInput}
            expertLabels={expertLabels}
            // Remounting on a new set id resets the draft exactly once.
            key={openSet.id}
            set={openSet}
            sessionExercise={sessionExercise}
            previousSets={previousSets}
            previousContext={lastPerformance?.sessionExercise}
            sessionSets={sets}
            recordBaseline={recordBaseline}
            targetDurationSeconds={effectiveTarget?.targetDurationSeconds}
            soundEnabled={soundEnabled}
            vibrationEnabled={vibrationEnabled}
            onPersist={(values) => void updateSet(openSet.id, values)}
            onComplete={(values) => handleComplete(openSet.id, values)}
            onDelete={() => void deleteSet(openSet.id)}
          />
        ) : setGoalReached ? (
          // Goal met: state it calmly and let the user opt into more work.
          <div className="grid gap-2">
            <p className="flex items-center justify-center gap-2 rounded-xl bg-surface-2 py-2 text-sm font-medium text-success">
              <Check size={16} aria-hidden="true" />
              {isCardio ? 'Intervallziel' : 'Satzziel'} erreicht ({completedWorkingSets}{' '}
              von {targetSets})
            </p>
            <Button
              variant="secondary"
              fullWidth
              disabled={isAdding}
              onClick={() => void handleAddSet()}
            >
              <Plus size={18} aria-hidden="true" />
              {isCardio ? 'Weiteren Abschnitt erfassen' : 'Extrasatz hinzufügen'}
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            fullWidth
            disabled={isAdding}
            onClick={() => void handleAddSet()}
          >
            <Plus size={18} aria-hidden="true" />
            {isCardio
              ? completedSets.length === 0
                ? 'Cardio erfassen'
                : 'Weiteren Abschnitt erfassen'
              : completedSets.length === 0
                ? 'Ersten Satz erfassen'
                : 'Weiteren Satz erfassen'}
          </Button>
        )}
      </div>

      {/* Strength takeaway only — cardio is not progressed by this rule. */}
      {progression && setGoalReached && !openSet && !isCardio ? (
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

      <ExecutionChangeDialog
        open={executionOpen}
        sessionExercise={sessionExercise}
        standard={
          exercise
            ? {
                equipment: exercise.defaultEquipment,
                weightMode: exercise.weightMode,
                weightMultiplier: exercise.weightMultiplier,
              }
            : undefined
        }
        onClose={() => setExecutionOpen(false)}
      />

      {editSet ? (
        <EditSetDialog
          open
          set={editSet}
          sessionExercise={sessionExercise}
          onClose={() => setEditSet(null)}
        />
      ) : null}
    </section>
  );
}
