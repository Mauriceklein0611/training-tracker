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
import { updateSettings } from '@/db/repositories/settings';
import { deleteTrainingHistory, resetAllData } from '@/db/repositories/maintenance';
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
    expect(await db.workoutTemplates.count()).toBe(1);
    expect(await db.templateExercises.count()).toBe(1);
    expect(await db.bodyWeightEntries.count()).toBe(1);
    expect(await db.equipmentProfiles.count()).toBe(1);
  });
});

describe('resetAllData', () => {
  it('clears every table and recreates default settings', async () => {
    await seedEverything();
    await updateSettings({ darkMode: 'light', voiceAnnouncementsEnabled: true });

    await resetAllData();

    expect(await db.exercises.count()).toBe(0);
    expect(await db.workoutTemplates.count()).toBe(0);
    expect(await db.workoutSessions.count()).toBe(0);
    expect(await db.bodyWeightEntries.count()).toBe(0);
    expect(await db.equipmentProfiles.count()).toBe(0);

    // Settings exist again, back at their defaults.
    const settings = await db.settings.get('app-settings');
    expect(settings).toBeDefined();
    expect(settings?.darkMode).toBe('dark');
    expect(settings?.voiceAnnouncementsEnabled).toBe(false);
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
