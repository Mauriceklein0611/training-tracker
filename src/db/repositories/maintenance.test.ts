import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { createExercise } from '@/db/repositories/exercises';
import { addExerciseToTemplate, createTemplate } from '@/db/repositories/templates';
import {
  addExerciseToSession,
  addSet,
  completeSet,
  finishSession,
  startFreeSession,
} from '@/db/repositories/sessions';
import { upsertBodyWeightEntry } from '@/db/repositories/bodyWeight';
import { createEquipmentProfile } from '@/db/repositories/equipmentProfiles';
import { createPlan } from '@/db/repositories/plans';
import { addCycleEntry, setScheduleMode } from '@/db/repositories/schedules';
import { updateSettings } from '@/db/repositories/settings';
import {
  ALL_DATA_TABLES,
  deleteTrainingHistory,
  resetAllData,
} from '@/db/repositories/maintenance';
import { SYSTEM_EXERCISES } from '@/constants/exerciseCatalog';
import { resetDatabase } from '@/tests/dbTestUtils';
import type { Exercise } from '@/types';

async function makeExerciseRow(name: string): Promise<Exercise> {
  return createExercise({
    name,
    primaryMuscleGroup: 'Test',
    secondaryMuscleGroups: [],
    equipment: '',
    trackingType: 'weight_reps',
    weightMode: 'total',
    weightMultiplier: 1,
    defaultRestSeconds: 120,
    notes: '',
  });
}

/** Seeds exercises, a plan, a finished + an active session, body data, a profile. */
async function seedEverything() {
  const exercise = await makeExerciseRow('Bankdrücken');
  const template = await createTemplate('Push');
  await addExerciseToTemplate(template.id, exercise);
  await upsertBodyWeightEntry({ date: '2026-07-20', weightKg: 80 });
  await createEquipmentProfile('Zuhause', ['Kurzhantel']);

  // A plan with a repeating cycle so both schedule stores hold rows.
  const plan = await createPlan({ name: 'PPL', splitType: '2-day' });
  await setScheduleMode(plan.id, 'repeating-cycle');
  await addCycleEntry(plan.id, { type: 'rest' });

  const finished = await startFreeSession('Fertig');
  const se = await addExerciseToSession(finished.id, exercise);
  const set = await addSet(se.id, { restTargetSeconds: 120 });
  await completeSet(set.id, { weightKg: 80, reps: 8 });
  await finishSession(finished.id);

  // An active draft.
  const active = await startFreeSession('Aktiv');
  await addExerciseToSession(active.id, exercise);
}

beforeEach(async () => {
  await resetDatabase();
});

describe('deleteTrainingHistory', () => {
  it('removes sessions/sets but keeps exercises, plans and body data', async () => {
    await seedEverything();
    await deleteTrainingHistory();

    expect(await db.workoutSessions.count()).toBe(0);
    expect(await db.sessionExercises.count()).toBe(0);
    expect(await db.workoutSets.count()).toBe(0);

    // Everything else stays.
    expect(await db.exercises.count()).toBe(1);
    // The orphan "Push" template plus the two days of the 2-day plan.
    expect(await db.workoutTemplates.count()).toBe(3);
    expect(await db.templateExercises.count()).toBe(1);
    expect(await db.bodyWeightEntries.count()).toBe(1);
    expect(await db.equipmentProfiles.count()).toBe(1);
    // Plans and their schedules are not training history — they stay. Two plans
    // exist: the single-day "Push" (from createTemplate) and the 2-day cycle.
    expect(await db.trainingPlans.count()).toBe(2);
    expect(await db.planSchedules.count()).toBe(1);
    expect(await db.scheduleEntries.count()).toBe(3);
  });
});

describe('resetAllData', () => {
  it('clears every table and recreates default settings', async () => {
    await seedEverything();
    await updateSettings({ darkMode: 'light', voiceAnnouncementsEnabled: true });

    await resetAllData();

    // Exercises are wiped and then re-seeded with the system catalog, so the
    // user's custom exercise is gone and only system entries remain.
    const exercises = await db.exercises.toArray();
    expect(exercises).toHaveLength(SYSTEM_EXERCISES.length);
    expect(exercises.every((exercise) => exercise.origin === 'system')).toBe(true);
    expect(await db.workoutTemplates.count()).toBe(0);
    expect(await db.workoutSessions.count()).toBe(0);
    expect(await db.bodyWeightEntries.count()).toBe(0);
    expect(await db.equipmentProfiles.count()).toBe(0);
    // The schedule stores are user data too and must be wiped (they were once
    // forgotten by the reset — 0.2).
    expect(await db.planSchedules.count()).toBe(0);
    expect(await db.scheduleEntries.count()).toBe(0);

    // Settings exist again, back at their defaults.
    const settings = await db.settings.get('app-settings');
    expect(settings).toBeDefined();
    expect(settings?.darkMode).toBe('dark');
    expect(settings?.voiceAnnouncementsEnabled).toBe(false);
  });

  it('reset table registry lists every store the database defines', () => {
    // Structural guard: a newly added store must be added to ALL_DATA_TABLES, or
    // the full reset would silently skip it even when it holds no rows yet.
    const defined = db.tables.map((table) => table.name).sort();
    expect([...ALL_DATA_TABLES].sort()).toEqual(defined);
  });

  it('clears every store the database defines, guarding against a forgotten table', async () => {
    await seedEverything();
    await updateSettings({ darkMode: 'light' });

    await resetAllData();

    // A store missing from the reset's table list would still hold rows here.
    // Two stores are deliberately repopulated to match a fresh install: settings
    // (one defaults row) and exercises (the re-seeded system catalog).
    for (const table of db.tables) {
      const count = await table.count();
      if (table.name === 'settings') {
        expect(count, 'settings is recreated as a single defaults row').toBe(1);
      } else if (table.name === 'exercises') {
        expect(count, 'exercises are re-seeded with the system catalog').toBe(
          SYSTEM_EXERCISES.length,
        );
      } else {
        expect(count, `store "${table.name}" was not cleared by resetAllData`).toBe(0);
      }
    }
  });
});

describe('transient state is cleared, not the whole localStorage', () => {
  it('deleting history drops a running timer but keeps the theme', async () => {
    localStorage.setItem('training-tracker.exercise-timer', '{"running":true}');
    localStorage.setItem('training-tracker.theme', 'dark');
    localStorage.setItem('unrelated-app.key', 'keep-me');

    await deleteTrainingHistory();

    expect(localStorage.getItem('training-tracker.exercise-timer')).toBeNull();
    expect(localStorage.getItem('training-tracker.theme')).toBe('dark');
    expect(localStorage.getItem('unrelated-app.key')).toBe('keep-me');
  });

  it('a full reset removes all training-tracker.* keys but nothing else', async () => {
    localStorage.setItem('training-tracker.exercise-timer', '{"running":true}');
    localStorage.setItem('training-tracker.theme', 'light');
    localStorage.setItem('unrelated-app.key', 'keep-me');

    await resetAllData();

    expect(localStorage.getItem('training-tracker.exercise-timer')).toBeNull();
    expect(localStorage.getItem('training-tracker.theme')).toBeNull();
    // A blanket clear would have removed this too — it must survive.
    expect(localStorage.getItem('unrelated-app.key')).toBe('keep-me');
  });
});
