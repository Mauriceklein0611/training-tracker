import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import {
  createExercise,
  deleteExercise,
  isExerciseInUse,
} from '@/db/repositories/exercises';
import {
  addExerciseToTemplate,
  createTemplate,
  duplicateTemplate,
  getTemplateWithExercises,
  moveTemplateExercise,
  updateTemplateExercise,
} from '@/db/repositories/templates';
import {
  ActiveSessionExistsError,
  addExerciseToSession,
  addSet,
  completeSet,
  deleteSession,
  endRest,
  finishSession,
  getActiveSession,
  getLastPerformance,
  getSessionDetail,
  startFreeSession,
  startSessionFromPreviousSession,
  startSessionFromTemplate,
  updateSet,
} from '@/db/repositories/sessions';
import { markBackupCreated } from '@/db/repositories/settings';
import { computeAnalytics } from '@/services/analytics';
import { createBackup, importBackup } from '@/services/backup';
import { loadAnalyticsDataset } from '@/services/dataset';
import { summarizeSession } from '@/services/sessionSummary';
import { computeRestProgress } from '@/services/rest';
import { isBackupOverdue } from '@/services/storage';
import { resetDatabase } from '@/tests/dbTestUtils';
import type { Exercise } from '@/types';

const BENCH = {
  name: 'Bankdrücken',
  primaryMuscleGroup: 'Brust',
  secondaryMuscleGroups: ['Trizeps'],
  equipment: 'Langhantel',
  trackingType: 'weight_reps' as const,
  weightMode: 'total' as const,
  weightMultiplier: 1,
  defaultRestSeconds: 120,
  notes: '',
};

const ROW = {
  ...BENCH,
  name: 'Kurzhantel-Rudern',
  primaryMuscleGroup: 'Rücken',
  secondaryMuscleGroups: ['Bizeps'],
  equipment: 'Kurzhantel',
  weightMode: 'per_hand' as const,
  weightMultiplier: 2,
};

beforeEach(async () => {
  await resetDatabase();
});

describe('central user flows', () => {
  it('walks the complete path from creating an exercise to restoring a backup', async () => {
    // ---- 1. create an exercise ------------------------------------------
    const bench = await createExercise(BENCH);
    expect(await db.exercises.count()).toBe(1);
    expect(bench.id).toBeTruthy();

    // ---- 2. create a plan -----------------------------------------------
    const template = await createTemplate('Oberkörper A', 'Push-Fokus');
    const templateExercise = await addExerciseToTemplate(template.id, bench);
    await updateTemplateExercise(templateExercise.id, {
      targetSets: 3,
      targetRepMin: 6,
      targetRepMax: 10,
      restSeconds: 150,
    });

    const plan = await getTemplateWithExercises(template.id);
    expect(plan?.exercises).toHaveLength(1);
    expect(plan?.exercises[0].restSeconds).toBe(150);

    // ---- 3. start a workout from the plan --------------------------------
    const session = await startSessionFromTemplate(template.id);
    expect(session.status).toBe('active');
    expect(session.name).toBe('Oberkörper A');

    let detail = await getSessionDetail(session.id);
    expect(detail?.exercises).toHaveLength(1);
    const sessionExerciseId = detail!.exercises[0].sessionExercise.id;

    // ---- 4. complete a set ----------------------------------------------
    const set = await addSet(sessionExerciseId, { restTargetSeconds: 150 });
    await completeSet(set.id, { weightKg: 80, reps: 8, rir: 2 });

    let stored = await db.workoutSets.get(set.id);
    expect(stored?.completedAt).toBeTruthy();
    expect(stored?.weightKg).toBe(80);
    // Completing a set starts the rest with an absolute timestamp.
    expect(stored?.restStartedAt).toBeTruthy();
    expect(stored?.restEndedAt).toBeUndefined();

    // ---- 5. end the rest -------------------------------------------------
    const restStart = new Date(stored!.restStartedAt!);
    await endRest(set.id, new Date(restStart.getTime() + 155_000));

    stored = await db.workoutSets.get(set.id);
    expect(stored?.restActualSeconds).toBe(155);
    expect(stored?.restEndedAt).toBeTruthy();
    // With the rest ended the timer is no longer running.
    expect(computeRestProgress(stored).running).toBe(false);

    // ---- 6. finish the workout -------------------------------------------
    await finishSession(session.id);
    const finished = await db.workoutSessions.get(session.id);
    expect(finished?.status).toBe('completed');
    expect(finished?.finishedAt).toBeTruthy();
    expect(await getActiveSession()).toBeUndefined();

    // ---- 7. open it in the history ---------------------------------------
    detail = await getSessionDetail(session.id);
    expect(detail?.exercises[0].sets).toHaveLength(1);
    expect(detail?.exercises[0].sets[0].reps).toBe(8);

    const summary = summarizeSession(await loadAnalyticsDataset(), session.id);
    expect(summary?.workingSetCount).toBe(1);
    expect(summary?.volume.volumeKg).toBe(640);
    expect(summary?.newRecords.some((record) => record.kind === 'load')).toBe(true);

    // ---- 8. the analysis reflects the data -------------------------------
    let analytics = computeAnalytics(await loadAnalyticsDataset(), null);
    expect(analytics.sessionCount).toBe(1);
    expect(analytics.volume.volumeKg).toBe(640);
    expect(analytics.restStatistics.averageDeviationSeconds).toBe(5);
    expect(
      analytics.muscleGroups.find((group) => group.muscleGroup === 'Brust')?.directSets,
    ).toBe(1);

    // A correction to the past workout updates the analysis immediately.
    await updateSet(set.id, { reps: 10 });
    analytics = computeAnalytics(await loadAnalyticsDataset(), null);
    expect(analytics.volume.volumeKg).toBe(800);

    // ---- 9. export a backup ----------------------------------------------
    const backup = await createBackup();
    expect(backup.exercises).toHaveLength(1);
    expect(backup.workoutSets).toHaveLength(1);
    await markBackupCreated();

    const settings = await db.settings.get('app-settings');
    expect(settings?.lastBackupAt).toBeTruthy();
    expect(isBackupOverdue(settings?.lastBackupAt, 14)).toBe(false);

    // ---- 10. restore the backup into an empty database --------------------
    await resetDatabase();
    expect(await db.workoutSets.count()).toBe(0);

    await importBackup(backup, 'replace');

    expect(await db.exercises.count()).toBe(1);
    expect(await db.workoutSets.count()).toBe(1);
    expect((await db.workoutSets.toCollection().first())?.reps).toBe(10);

    const restoredAnalytics = computeAnalytics(await loadAnalyticsDataset(), null);
    expect(restoredAnalytics.volume.volumeKg).toBe(800);
  });
});

describe('active session handling', () => {
  it('recovers a running workout, which is what makes "continue" work after a restart', async () => {
    const session = await startFreeSession('Unterbrochen');
    const active = await getActiveSession();

    expect(active?.id).toBe(session.id);
    expect(active?.status).toBe('active');
  });

  it('reports no active session on a fresh database', async () => {
    expect(await getActiveSession()).toBeUndefined();
  });

  it('allows only one active workout at a time', async () => {
    await startFreeSession('Erste');
    await expect(startFreeSession('Zweite')).rejects.toBeInstanceOf(
      ActiveSessionExistsError,
    );
    expect(await db.workoutSessions.count()).toBe(1);
  });

  it('points at the running workout so the user can be sent there', async () => {
    const first = await startFreeSession('Erste');
    await expect(startFreeSession('Zweite')).rejects.toMatchObject({
      activeSessionId: first.id,
    });
  });

  it('allows a new workout once the previous one is finished', async () => {
    const first = await startFreeSession('Erste');
    await finishSession(first.id);

    const second = await startFreeSession('Zweite');
    expect(second.status).toBe('active');
  });

  it('keeps a rest period correct across a simulated app restart', async () => {
    const exercise = await createExercise(BENCH);
    const session = await startFreeSession();
    const sessionExercise = await addExerciseToSession(session.id, exercise);
    const set = await addSet(sessionExercise.id, { restTargetSeconds: 120 });
    await completeSet(set.id, { weightKg: 60, reps: 10 });

    // Simulate closing and reopening the app: nothing is kept in memory.
    await db.close();
    await db.open();

    const restored = await db.workoutSets.get(set.id);
    const startedAt = new Date(restored!.restStartedAt!);
    const progress = computeRestProgress(
      restored,
      new Date(startedAt.getTime() + 300_000),
    );

    // Five minutes passed while the app was closed — the timer knows it.
    expect(progress.elapsedSeconds).toBe(300);
    expect(progress.targetReached).toBe(true);
    expect(progress.overtimeSeconds).toBe(180);
  });

  it('discards a workout completely when it is thrown away', async () => {
    const exercise = await createExercise(BENCH);
    const session = await startFreeSession();
    const sessionExercise = await addExerciseToSession(session.id, exercise);
    await addSet(sessionExercise.id, { restTargetSeconds: 60 });

    await deleteSession(session.id);

    expect(await db.workoutSessions.count()).toBe(0);
    expect(await db.sessionExercises.count()).toBe(0);
    expect(await db.workoutSets.count()).toBe(0);
  });

  it('removes planned but unperformed sets when finishing', async () => {
    const exercise = await createExercise(BENCH);
    const session = await startFreeSession();
    const sessionExercise = await addExerciseToSession(session.id, exercise);

    const done = await addSet(sessionExercise.id, { restTargetSeconds: 60 });
    await completeSet(done.id, { weightKg: 50, reps: 10 });
    await addSet(sessionExercise.id, { restTargetSeconds: 60 }); // never completed

    await finishSession(session.id);

    expect(await db.workoutSets.count()).toBe(1);
  });
});

describe('free workouts and history reuse', () => {
  let bench: Exercise;

  beforeEach(async () => {
    bench = await createExercise(BENCH);
  });

  it('records a free workout without a template', async () => {
    const session = await startFreeSession();
    expect(session.templateId).toBeUndefined();

    const sessionExercise = await addExerciseToSession(session.id, bench);
    const set = await addSet(sessionExercise.id, { restTargetSeconds: 90 });
    await completeSet(set.id, { weightKg: 70, reps: 6 });
    await finishSession(session.id);

    const analytics = computeAnalytics(await loadAnalyticsDataset(), null);
    expect(analytics.volume.volumeKg).toBe(420);
  });

  it('suggests the previous performance of an exercise', async () => {
    const first = await startFreeSession();
    const firstExercise = await addExerciseToSession(first.id, bench);
    const firstSet = await addSet(firstExercise.id, { restTargetSeconds: 90 });
    await completeSet(firstSet.id, { weightKg: 75, reps: 8 });
    await finishSession(first.id);

    const second = await startFreeSession();
    const last = await getLastPerformance(bench.id, second.id);

    expect(last?.sets).toHaveLength(1);
    expect(last?.sets[0].weightKg).toBe(75);
  });

  it('does not suggest the running workout to itself', async () => {
    const session = await startFreeSession();
    const sessionExercise = await addExerciseToSession(session.id, bench);
    const set = await addSet(sessionExercise.id, { restTargetSeconds: 90 });
    await completeSet(set.id, { weightKg: 75, reps: 8 });

    expect(await getLastPerformance(bench.id, session.id)).toBeUndefined();
  });

  it('starts a new workout based on an earlier one', async () => {
    const first = await startFreeSession('Zug A');
    await addExerciseToSession(first.id, bench);
    await finishSession(first.id);

    const repeat = await startSessionFromPreviousSession(first.id);
    const detail = await getSessionDetail(repeat.id);

    expect(repeat.name).toBe('Zug A');
    expect(detail?.exercises).toHaveLength(1);
    // The copy starts empty — only the exercise list is reused.
    expect(detail?.exercises[0].sets).toHaveLength(0);
  });

  it('keeps history readable after an exercise is renamed', async () => {
    const session = await startFreeSession();
    const sessionExercise = await addExerciseToSession(session.id, bench);
    const set = await addSet(sessionExercise.id, { restTargetSeconds: 90 });
    await completeSet(set.id, { weightKg: 60, reps: 10 });
    await finishSession(session.id);

    await db.exercises.update(bench.id, { name: 'Bankdrücken (neu benannt)' });

    const detail = await getSessionDetail(session.id);
    // The snapshot preserves what the exercise was called at the time.
    expect(detail?.exercises[0].sessionExercise.exerciseNameSnapshot).toBe('Bankdrücken');
  });

  it('protects trained exercises from being deleted', async () => {
    const session = await startFreeSession();
    await addExerciseToSession(session.id, bench);
    await finishSession(session.id);

    expect(await isExerciseInUse(bench.id)).toBe(true);
    await expect(deleteExercise(bench.id)).rejects.toThrow(/archiviere/i);
    expect(await db.exercises.count()).toBe(1);
  });

  it('allows deleting an exercise that was never trained', async () => {
    await deleteExercise(bench.id);
    expect(await db.exercises.count()).toBe(0);
  });

  it('applies the weight multiplier of a per-hand exercise end to end', async () => {
    const row = await createExercise(ROW);
    const session = await startFreeSession();
    const sessionExercise = await addExerciseToSession(session.id, row);
    const set = await addSet(sessionExercise.id, { restTargetSeconds: 90 });
    await completeSet(set.id, { weightKg: 22.5, reps: 10 });
    await finishSession(session.id);

    const analytics = computeAnalytics(await loadAnalyticsDataset(), null);
    // 22.5 kg per hand × 2 hands × 10 reps
    expect(analytics.volume.volumeKg).toBe(450);
  });
});

describe('plan management', () => {
  it('reorders plan exercises with the accessible up/down controls', async () => {
    const bench = await createExercise(BENCH);
    const row = await createExercise(ROW);
    const template = await createTemplate('Ganzkörper');

    await addExerciseToTemplate(template.id, bench);
    const second = await addExerciseToTemplate(template.id, row);

    await moveTemplateExercise(second.id, -1);

    const plan = await getTemplateWithExercises(template.id);
    expect(plan?.exercises.map((entry) => entry.exercise?.name)).toEqual([
      'Kurzhantel-Rudern',
      'Bankdrücken',
    ]);
    expect(plan?.exercises.map((entry) => entry.order)).toEqual([0, 1]);
  });

  it('duplicates a plan including its exercises', async () => {
    const bench = await createExercise(BENCH);
    const template = await createTemplate('Oberkörper');
    await addExerciseToTemplate(template.id, bench);

    const copy = await duplicateTemplate(template.id);
    const plan = await getTemplateWithExercises(copy.id);

    expect(copy.name).toBe('Oberkörper (Kopie)');
    expect(plan?.exercises).toHaveLength(1);
    expect(plan?.exercises[0].id).not.toBe(template.id);
  });
});
