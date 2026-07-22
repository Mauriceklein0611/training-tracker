import { useEffect, useMemo, useRef } from 'react';
import type { SessionDetail } from '@/db/repositories/sessions';
import { computeRestProgress, type RestProgress } from '@/services/rest';
import { playRestFinishedSound, vibrate } from '@/services/sound';
import { speak } from '@/services/speech';
import { useNow } from '@/hooks/useNow';
import type { WorkoutSet } from '@/types';

export interface ActiveRest {
  set: WorkoutSet;
  exerciseName: string;
  progress: RestProgress;
}

/**
 * Finds the rest period that is currently running and derives its progress.
 *
 * The value is recomputed from `restStartedAt` on every tick, so it is correct
 * after a locked screen, a backgrounded app or a reload — nothing is counted
 * in React state.
 */
export function useActiveRest(
  detail: SessionDetail | undefined,
  options: { soundEnabled: boolean; vibrationEnabled: boolean; voiceEnabled?: boolean },
): ActiveRest | null {
  const candidate = useMemo(() => {
    if (!detail) return null;
    let best: { set: WorkoutSet; exerciseName: string } | null = null;
    let bestStartedAt = '';
    for (const entry of detail.exercises) {
      for (const set of entry.sets) {
        const startedAt = set.restStartedAt;
        if (!startedAt || set.restEndedAt) continue;
        // The most recently started rest is the one the user is waiting on.
        if (!best || startedAt > bestStartedAt) {
          best = { set, exerciseName: entry.sessionExercise.exerciseNameSnapshot };
          bestStartedAt = startedAt;
        }
      }
    }
    return best;
  }, [detail]);

  // Only run the interval while a rest is actually in progress.
  const now = useNow(1000, Boolean(candidate));
  const progress = computeRestProgress(candidate?.set, now);

  // Fire the notification exactly once per rest period.
  const notifiedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!candidate || !progress.targetReached) return;
    if (notifiedFor.current === candidate.set.id) return;
    notifiedFor.current = candidate.set.id;

    if (options.soundEnabled) playRestFinishedSound();
    if (options.vibrationEnabled) vibrate();
    if (options.voiceEnabled) speak(`Pause beendet. Weiter mit ${candidate.exerciseName}.`);
  }, [
    candidate,
    progress.targetReached,
    options.soundEnabled,
    options.vibrationEnabled,
    options.voiceEnabled,
  ]);

  if (!candidate) return null;
  return { set: candidate.set, exerciseName: candidate.exerciseName, progress };
}
