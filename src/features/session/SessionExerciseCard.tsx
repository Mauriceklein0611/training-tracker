import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
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
  updateSessionExercise,
  updateSet,
  type SessionExerciseDetail,
} from '@/db/repositories/sessions';
import { primeAudio } from '@/services/sound';
import { TRACKING_TYPE_LABELS, describeSet, formatKg } from '@/utils/format';
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
  defaultRestSeconds,
}: {
  detail: SessionExerciseDetail;
  sessionId: string;
  index: number;
  total: number;
  target?: TemplateExercise;
  defaultRestSeconds: number;
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

  const restTarget = target?.restSeconds ?? defaultRestSeconds;

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

  const suggestionText = useMemo(() => {
    if (!lastPerformance) return undefined;
    const working = lastPerformance.sets.filter((set) => set.setType !== 'warmup');
    if (working.length === 0) return undefined;
    const summary = working
      .slice(0, 4)
      .map((set) =>
        describeSet(
          set,
          sessionExercise.trackingTypeSnapshot,
          sessionExercise.weightModeSnapshot,
        ),
      )
      .join(' · ');
    return `${formatDate(lastPerformance.session.startedAt)} — ${summary}`;
  }, [lastPerformance, sessionExercise]);

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
    // Immediately queue the next set with the same values as a suggestion.
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
      className="rounded-2xl border border-border bg-surface p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id={`exercise-${sessionExercise.id}`} className="font-semibold leading-tight">
            <span className="text-muted">{index + 1}. </span>
            {sessionExercise.exerciseNameSnapshot}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            <Badge>{TRACKING_TYPE_LABELS[sessionExercise.trackingTypeSnapshot]}</Badge>
            {describeTarget(target) ? <span>Ziel: {describeTarget(target)}</span> : null}
            <span>Pause {restTarget}s</span>
            {sessionExercise.weightModeSnapshot === 'per_hand' ? (
              <span>je Hand ×{sessionExercise.weightMultiplierSnapshot}</span>
            ) : null}
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
            suggestion={completedSets.length === 0 ? suggestionText : undefined}
            onPersist={(values) => void updateSet(openSet.id, values)}
            onComplete={(values) => void handleComplete(openSet.id, values)}
            onDelete={() => void deleteSet(openSet.id)}
          />
        ) : (
          <Button variant="secondary" fullWidth onClick={() => void handleAddSet()}>
            <Plus size={18} aria-hidden="true" />
            {completedSets.length === 0 ? 'Ersten Satz erfassen' : 'Weiteren Satz erfassen'}
          </Button>
        )}
      </div>

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
