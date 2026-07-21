import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/db';
import type { WorkoutSession } from '@/types';

/**
 * The workout currently in progress, if any.
 *
 * Because this is a live query it also recovers an interrupted session after a
 * reload or an app restart — the home screen uses it to offer "fortsetzen".
 * `undefined` means "still loading", `null` means "there is none".
 */
export function useActiveSession(): WorkoutSession | null | undefined {
  return useLiveQuery(async () => {
    const sessions = await db.workoutSessions.where('status').equals('active').toArray();
    if (sessions.length === 0) return null;
    sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return sessions[0];
  }, []);
}
