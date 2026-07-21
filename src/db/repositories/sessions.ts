import { db, ensureSettings } from '@/db/db';
import type {
  Exercise,
  SessionExercise,
  SetType,
  WorkoutSession,
  WorkoutSet,
} from '@/types';
import { nowIso, uuid } from '@/utils/id';
import { getTemplateWithExercises } from '@/db/repositories/templates';
import { resolveRestSeconds } from '@/services/rest';

export interface SessionExerciseDetail {
  sessionExercise: SessionExercise;
  sets: WorkoutSet[];
}

export interface SessionDetail {
  session: WorkoutSession;
  exercises: SessionExerciseDetail[];
}

export class ActiveSessionExistsError extends Error {
  constructor(public readonly activeSessionId: string) {
    super('Es läuft bereits eine Trainingseinheit. Beende sie zuerst.');
    this.name = 'ActiveSessionExistsError';
  }
}

/**
 * The single session with status "active", if any.
 * Used on startup to offer resuming an interrupted workout.
 */
export async function getActiveSession(): Promise<WorkoutSession | undefined> {
  const active = await db.workoutSessions.where('status').equals('active').toArray();
  if (active.length <= 1) return active[0];
  // Defensive: if several actives ever existed, keep the newest and close the rest
  // rather than silently showing an arbitrary one.
  active.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return active[0];
}

function buildSessionExercise(
  sessionId: string,
  exercise: Exercise,
  order: number,
  context: {
    /** Rest prescribed by the plan for this exercise, if it came from one. */
    templateRestSeconds?: number | null;
    /** Global default from the settings. */
    globalDefaultRestSeconds?: number | null;
    targetSets?: number;
  } = {},
): SessionExercise {
  const timestamp = nowIso();
  return {
    id: uuid(),
    sessionId,
    exerciseId: exercise.id,
    order,
    // Snapshots keep old sessions readable even if the exercise changes later.
    exerciseNameSnapshot: exercise.name,
    trackingTypeSnapshot: exercise.trackingType,
    weightModeSnapshot: exercise.weightMode,
    weightMultiplierSnapshot: exercise.weightMultiplier,
    restSecondsSnapshot: resolveRestSeconds({
      templateRestSeconds: context.templateRestSeconds,
      exerciseDefaultRestSeconds: exercise.defaultRestSeconds,
      globalDefaultRestSeconds: context.globalDefaultRestSeconds,
    }),
    targetSetsSnapshot: context.targetSets,
    notes: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * Global default rest from the settings.
 * Read outside any transaction, because `ensureSettings` may write.
 */
async function readGlobalRestDefault(): Promise<number> {
  const settings = await ensureSettings();
  return settings.defaultRestSeconds;
}

/** Starts a free workout without a template. */
export async function startFreeSession(name = 'Freies Training'): Promise<WorkoutSession> {
  return db.transaction('rw', db.workoutSessions, async () => {
    await assertNoActiveSession();
    const timestamp = nowIso();
    const session: WorkoutSession = {
      id: uuid(),
      name,
      status: 'active',
      startedAt: timestamp,
      notes: '',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.workoutSessions.add(session);
    return session;
  });
}

/** Starts a workout pre-filled with the template's exercises and target rest times. */
export async function startSessionFromTemplate(templateId: string): Promise<WorkoutSession> {
  const template = await getTemplateWithExercises(templateId);
  if (!template) throw new Error('Der Trainingsplan wurde nicht gefunden.');
  const globalDefaultRestSeconds = await readGlobalRestDefault();

  return db.transaction('rw', db.workoutSessions, db.sessionExercises, db.workoutSets, async () => {
    await assertNoActiveSession();
    const timestamp = nowIso();
    const session: WorkoutSession = {
      id: uuid(),
      templateId,
      name: template.template.name,
      status: 'active',
      startedAt: timestamp,
      notes: '',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.workoutSessions.add(session);

    for (const [index, row] of template.exercises.entries()) {
      if (!row.exercise) continue; // exercise was deleted — skip rather than fail
      const sessionExercise = buildSessionExercise(session.id, row.exercise, index, {
        templateRestSeconds: row.restSeconds,
        globalDefaultRestSeconds,
        targetSets: row.targetSets,
      });
      sessionExercise.notes = row.notes;
      await db.sessionExercises.add(sessionExercise);
    }
    return session;
  });
}

/** Starts a new workout that mirrors the exercise list of an earlier session. */
export async function startSessionFromPreviousSession(
  sourceSessionId: string,
): Promise<WorkoutSession> {
  const source = await getSessionDetail(sourceSessionId);
  if (!source) throw new Error('Die Trainingseinheit wurde nicht gefunden.');

  return db.transaction('rw', db.workoutSessions, db.sessionExercises, async () => {
    await assertNoActiveSession();
    const timestamp = nowIso();
    const session: WorkoutSession = {
      id: uuid(),
      templateId: source.session.templateId,
      name: source.session.name,
      status: 'active',
      startedAt: timestamp,
      notes: '',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.workoutSessions.add(session);

    for (const entry of source.exercises) {
      await db.sessionExercises.add({
        ...entry.sessionExercise,
        id: uuid(),
        sessionId: session.id,
        notes: '',
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
    return session;
  });
}

async function assertNoActiveSession(): Promise<void> {
  const active = await db.workoutSessions.where('status').equals('active').first();
  if (active) throw new ActiveSessionExistsError(active.id);
}

/**
 * Adds an exercise to a running workout (free workout, or an ad-hoc addition).
 * There is no plan target here, so the rest falls back to the exercise's own
 * default before the global one.
 */
export async function addExerciseToSession(
  sessionId: string,
  exercise: Exercise,
): Promise<SessionExercise> {
  const globalDefaultRestSeconds = await readGlobalRestDefault();

  return db.transaction('rw', db.sessionExercises, db.workoutSessions, async () => {
    const count = await db.sessionExercises.where('sessionId').equals(sessionId).count();
    const sessionExercise = buildSessionExercise(sessionId, exercise, count, {
      globalDefaultRestSeconds,
    });
    await db.sessionExercises.add(sessionExercise);
    await touchSession(sessionId);
    return sessionExercise;
  });
}

/** Removes an exercise from a session, including all of its sets. */
export async function removeSessionExercise(sessionExerciseId: string): Promise<void> {
  await db.transaction('rw', db.sessionExercises, db.workoutSets, db.workoutSessions, async () => {
    const entry = await db.sessionExercises.get(sessionExerciseId);
    if (!entry) return;
    await db.workoutSets.where('sessionExerciseId').equals(sessionExerciseId).delete();
    await db.sessionExercises.delete(sessionExerciseId);

    const siblings = await db.sessionExercises.where('sessionId').equals(entry.sessionId).toArray();
    siblings.sort((a, b) => a.order - b.order);
    await Promise.all(
      siblings.map((sibling, position) =>
        db.sessionExercises.update(sibling.id, { order: position }),
      ),
    );
    await touchSession(entry.sessionId);
  });
}

export async function moveSessionExercise(
  sessionExerciseId: string,
  direction: -1 | 1,
): Promise<void> {
  await db.transaction('rw', db.sessionExercises, async () => {
    const entry = await db.sessionExercises.get(sessionExerciseId);
    if (!entry) return;
    const siblings = await db.sessionExercises.where('sessionId').equals(entry.sessionId).toArray();
    siblings.sort((a, b) => a.order - b.order);

    const index = siblings.findIndex((sibling) => sibling.id === sessionExerciseId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= siblings.length) return;

    [siblings[index], siblings[targetIndex]] = [siblings[targetIndex], siblings[index]];
    await Promise.all(
      siblings.map((sibling, position) =>
        db.sessionExercises.update(sibling.id, { order: position }),
      ),
    );
  });
}

export async function updateSessionExercise(
  sessionExerciseId: string,
  changes: Partial<Pick<SessionExercise, 'notes'>>,
): Promise<void> {
  await db.sessionExercises.update(sessionExerciseId, { ...changes, updatedAt: nowIso() });
}

export interface NewSetInput {
  setType?: SetType;
  weightKg?: number;
  reps?: number;
  durationSeconds?: number;
  rir?: number;
  rpe?: number;
  restTargetSeconds: number;
}

/** Appends an empty (not yet completed) set to an exercise. */
export async function addSet(
  sessionExerciseId: string,
  input: NewSetInput,
): Promise<WorkoutSet> {
  return db.transaction('rw', db.workoutSets, async () => {
    const existing = await db.workoutSets
      .where('sessionExerciseId')
      .equals(sessionExerciseId)
      .count();
    const timestamp = nowIso();
    const set: WorkoutSet = {
      id: uuid(),
      sessionExerciseId,
      position: existing,
      setType: input.setType ?? 'working',
      weightKg: input.weightKg,
      reps: input.reps,
      durationSeconds: input.durationSeconds,
      rir: input.rir,
      rpe: input.rpe,
      restTargetSeconds: input.restTargetSeconds,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.workoutSets.add(set);
    return set;
  });
}

export async function updateSet(
  setId: string,
  changes: Partial<Omit<WorkoutSet, 'id' | 'sessionExerciseId' | 'createdAt'>>,
): Promise<void> {
  await db.workoutSets.update(setId, { ...changes, updatedAt: nowIso() });
}

export async function deleteSet(setId: string): Promise<void> {
  await db.transaction('rw', db.workoutSets, async () => {
    const set = await db.workoutSets.get(setId);
    if (!set) return;
    await db.workoutSets.delete(setId);
    const siblings = await db.workoutSets
      .where('sessionExerciseId')
      .equals(set.sessionExerciseId)
      .toArray();
    siblings.sort((a, b) => a.position - b.position);
    await Promise.all(
      siblings.map((sibling, position) => db.workoutSets.update(sibling.id, { position })),
    );
  });
}

/**
 * Elapsed rest in whole seconds, clamped at zero.
 *
 * The clamp guards against a device clock that jumped backwards; a negative
 * rest would otherwise poison every average built on top of it.
 */
function elapsedRestSeconds(startedAt: string, endedAt: Date): number {
  const started = new Date(startedAt).getTime();
  if (Number.isNaN(started)) return 0;
  return Math.max(0, Math.round((endedAt.getTime() - started) / 1000));
}

/**
 * Ends every rest of a session that was started but never closed.
 *
 * A workout may only ever have one running rest: the live view shows the most
 * recent one, so an older open rest would be invisible and its duration lost.
 *
 * Idempotent — only sets with `restStartedAt` and no `restEndedAt` are touched,
 * so a second call changes nothing. Returns the number of rests that were
 * closed, which makes the behaviour straightforward to assert in tests.
 *
 * Expects to run inside a transaction covering sessionExercises and workoutSets.
 */
async function closeOpenRestsInTransaction(
  sessionId: string,
  endedAt: Date,
): Promise<number> {
  const sessionExercises = await db.sessionExercises
    .where('sessionId')
    .equals(sessionId)
    .toArray();

  let closed = 0;
  for (const entry of sessionExercises) {
    const sets = await db.workoutSets.where('sessionExerciseId').equals(entry.id).toArray();

    for (const set of sets) {
      if (!set.restStartedAt || set.restEndedAt) continue;
      await db.workoutSets.update(set.id, {
        restEndedAt: endedAt.toISOString(),
        restActualSeconds: elapsedRestSeconds(set.restStartedAt, endedAt),
        updatedAt: nowIso(),
      });
      closed += 1;
    }
  }
  return closed;
}

/** Closes all running rests of a session. Opens its own transaction. */
export async function closeOpenRests(
  sessionId: string,
  endedAt: Date = new Date(),
): Promise<number> {
  return db.transaction('rw', db.sessionExercises, db.workoutSets, () =>
    closeOpenRestsInTransaction(sessionId, endedAt),
  );
}

/**
 * Marks a set as done and immediately starts its rest period.
 *
 * The rest period is anchored to an absolute timestamp so it stays correct when
 * the screen locks, the tab is backgrounded, or the app is reloaded.
 *
 * Any rest still running in this workout is closed first. Without that, quickly
 * completing several sets would leave earlier rests open forever: the live view
 * only ever shows the newest one, so the older durations would never be
 * recorded.
 */
export async function completeSet(
  setId: string,
  values: Partial<Pick<WorkoutSet, 'weightKg' | 'reps' | 'durationSeconds' | 'rir' | 'rpe' | 'setType'>>,
  options: { startRest?: boolean } = {},
): Promise<void> {
  await db.transaction('rw', db.sessionExercises, db.workoutSets, async () => {
    const set = await db.workoutSets.get(setId);
    if (!set) return;

    const completedAt = new Date();
    const timestamp = completedAt.toISOString();

    const sessionExercise = await db.sessionExercises.get(set.sessionExerciseId);
    if (sessionExercise) {
      await closeOpenRestsInTransaction(sessionExercise.sessionId, completedAt);
    }

    await db.workoutSets.update(setId, {
      ...values,
      completedAt: timestamp,
      restStartedAt: options.startRest === false ? undefined : timestamp,
      restEndedAt: undefined,
      restActualSeconds: undefined,
      updatedAt: timestamp,
    });
  });
}

/**
 * Ends the current rest period and records how long it actually lasted.
 * Idempotent: an already closed rest keeps its recorded duration.
 */
export async function endRest(setId: string, endedAt: Date = new Date()): Promise<void> {
  const set = await db.workoutSets.get(setId);
  if (!set?.restStartedAt || set.restEndedAt) return;

  await db.workoutSets.update(setId, {
    restEndedAt: endedAt.toISOString(),
    restActualSeconds: elapsedRestSeconds(set.restStartedAt, endedAt),
    updatedAt: nowIso(),
  });
}

export async function updateSession(
  sessionId: string,
  changes: Partial<Pick<WorkoutSession, 'name' | 'notes' | 'startedAt' | 'finishedAt'>>,
): Promise<void> {
  await db.workoutSessions.update(sessionId, { ...changes, updatedAt: nowIso() });
}

async function touchSession(sessionId: string): Promise<void> {
  await db.workoutSessions.update(sessionId, { updatedAt: nowIso() });
}

/** Completes a session. Sets that were never finished are removed. */
export async function finishSession(sessionId: string): Promise<void> {
  await db.transaction('rw', db.workoutSessions, db.sessionExercises, db.workoutSets, async () => {
    // The rest after the final set is still running when the workout ends.
    // Close it against the finish time so its duration is recorded rather than
    // silently dropped from every statistic.
    const finishedAt = new Date();
    await closeOpenRestsInTransaction(sessionId, finishedAt);

    const sessionExercises = await db.sessionExercises
      .where('sessionId')
      .equals(sessionId)
      .toArray();

    for (const entry of sessionExercises) {
      const sets = await db.workoutSets.where('sessionExerciseId').equals(entry.id).toArray();
      // Drop planned-but-never-performed sets so they cannot skew any statistic.
      const empty = sets.filter((set) => !set.completedAt);
      await db.workoutSets.bulkDelete(empty.map((set) => set.id));

      const remaining = sets
        .filter((set) => set.completedAt)
        .sort((a, b) => a.position - b.position);
      await Promise.all(
        remaining.map((set, position) =>
          set.position === position
            ? Promise.resolve(0)
            : db.workoutSets.update(set.id, { position }),
        ),
      );
    }

    // Same instant the rests were closed against, so the numbers agree.
    const timestamp = finishedAt.toISOString();
    await db.workoutSessions.update(sessionId, {
      status: 'completed',
      finishedAt: timestamp,
      updatedAt: timestamp,
    });
  });
}

/** Deletes a session and everything below it. Used for "discard workout". */
export async function deleteSession(sessionId: string): Promise<void> {
  await db.transaction('rw', db.workoutSessions, db.sessionExercises, db.workoutSets, async () => {
    const sessionExercises = await db.sessionExercises
      .where('sessionId')
      .equals(sessionId)
      .toArray();
    for (const entry of sessionExercises) {
      await db.workoutSets.where('sessionExerciseId').equals(entry.id).delete();
    }
    await db.sessionExercises.where('sessionId').equals(sessionId).delete();
    await db.workoutSessions.delete(sessionId);
  });
}

export async function getSessionDetail(sessionId: string): Promise<SessionDetail | undefined> {
  const session = await db.workoutSessions.get(sessionId);
  if (!session) return undefined;

  const sessionExercises = await db.sessionExercises.where('sessionId').equals(sessionId).toArray();
  sessionExercises.sort((a, b) => a.order - b.order);

  const exercises = await Promise.all(
    sessionExercises.map(async (sessionExercise) => {
      const sets = await db.workoutSets
        .where('sessionExerciseId')
        .equals(sessionExercise.id)
        .toArray();
      sets.sort((a, b) => a.position - b.position);
      return { sessionExercise, sets };
    }),
  );
  return { session, exercises };
}

export async function listCompletedSessions(): Promise<WorkoutSession[]> {
  const sessions = await db.workoutSessions.where('status').equals('completed').toArray();
  return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/** Duplicates a completed session including all sets (for manual corrections). */
export async function duplicateSession(sessionId: string): Promise<WorkoutSession> {
  const source = await getSessionDetail(sessionId);
  if (!source) throw new Error('Die Trainingseinheit wurde nicht gefunden.');

  return db.transaction('rw', db.workoutSessions, db.sessionExercises, db.workoutSets, async () => {
    const timestamp = nowIso();
    const copy: WorkoutSession = {
      ...source.session,
      id: uuid(),
      name: `${source.session.name} (Kopie)`,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.workoutSessions.add(copy);

    for (const entry of source.exercises) {
      const newExerciseId = uuid();
      await db.sessionExercises.add({
        ...entry.sessionExercise,
        id: newExerciseId,
        sessionId: copy.id,
      });
      await db.workoutSets.bulkAdd(
        entry.sets.map((set) => ({ ...set, id: uuid(), sessionExerciseId: newExerciseId })),
      );
    }
    return copy;
  });
}

export interface LastPerformance {
  session: WorkoutSession;
  sessionExercise: SessionExercise;
  sets: WorkoutSet[];
}

/**
 * Most recent completed performance of an exercise, used to pre-fill the live
 * view with the previous numbers. `excludeSessionId` keeps the running workout
 * out of its own suggestion.
 */
export async function getLastPerformance(
  exerciseId: string,
  excludeSessionId?: string,
): Promise<LastPerformance | undefined> {
  const entries = await db.sessionExercises.where('exerciseId').equals(exerciseId).toArray();
  const candidates: LastPerformance[] = [];

  for (const sessionExercise of entries) {
    if (sessionExercise.sessionId === excludeSessionId) continue;
    const session = await db.workoutSessions.get(sessionExercise.sessionId);
    if (!session || session.status !== 'completed') continue;
    const sets = await db.workoutSets
      .where('sessionExerciseId')
      .equals(sessionExercise.id)
      .toArray();
    const completed = sets
      .filter((set) => set.completedAt)
      .sort((a, b) => a.position - b.position);
    if (completed.length === 0) continue;
    candidates.push({ session, sessionExercise, sets: completed });
  }

  candidates.sort((a, b) => b.session.startedAt.localeCompare(a.session.startedAt));
  return candidates[0];
}
