import { beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from '@/tests/dbTestUtils';
import { createExercise } from '@/db/repositories/exercises';
import {
  addExerciseToSession,
  addSet,
  completeSet,
  finishSession,
  setSessionExerciseExecution,
  startFreeSession,
} from '@/db/repositories/sessions';
import { loadAnalyticsDataset } from '@/services/dataset';
import { buildSetContexts } from '@/services/analytics';
import { aggregateVolume, computePersonalRecords } from '@/services/metrics';
import type { Exercise } from '@/types';

async function barbellPress(): Promise<Exercise> {
  return createExercise({
    name: 'Schulterdrücken',
    primaryMuscleGroup: 'Schultern',
    secondaryMuscleGroups: [],
    equipment: 'Langhantel',
    defaultEquipment: 'barbell',
    trackingType: 'weight_reps',
    weightMode: 'total',
    weightMultiplier: 1,
    defaultRestSeconds: 120,
    notes: '',
  });
}

beforeEach(async () => {
  await resetDatabase();
});

describe('equipment regression — the full spec scenario', () => {
  it('merges volume under the exercise but keeps records apart per equipment', async () => {
    const exercise = await barbellPress();
    const session = await startFreeSession('Test');
    const se = await addExerciseToSession(session.id, exercise);

    // Set 1: 40 kg barbell × 10 → 400 kg.
    const s1 = await addSet(se.id, { restTargetSeconds: 120 });
    await completeSet(s1.id, { weightKg: 40, reps: 10 });

    // Barbell taken → switch to dumbbells (per hand ×2) for the rest.
    await setSessionExerciseExecution(se.id, {
      equipment: 'dumbbells',
      weightMode: 'per_hand',
      weightMultiplier: 2,
    });

    // Set 2: 20 kg per dumbbell × 10 → 40 kg total × 10 = 400 kg.
    const s2 = await addSet(se.id, { restTargetSeconds: 120 });
    await completeSet(s2.id, { weightKg: 20, reps: 10 });
    await finishSession(session.id);

    const dataset = await loadAnalyticsDataset();
    const contexts = buildSetContexts(dataset);

    // Volume is merged under the one exercise: 400 + 400 = 800 kg.
    expect(aggregateVolume(contexts).volumeKg).toBe(800);

    // Records are split by execution: one barbell line, one dumbbell line, each
    // with a 40 kg best total load — neither overwrites the other.
    const records = computePersonalRecords(contexts);
    expect(records.size).toBe(2);
    const byEquipment = new Map(
      [...records.values()].map((record) => [record.equipment, record]),
    );
    expect(byEquipment.get('barbell')?.bestLoadKg).toBe(40);
    expect(byEquipment.get('dumbbells')?.bestLoadKg).toBe(40);

    // History still distinguishes the two sets' executions.
    const byId = new Map(dataset.sets.map((set) => [set.id, set]));
    expect(byId.get(s1.id)?.equipmentSnapshot).toBe('barbell');
    expect(byId.get(s2.id)?.equipmentSnapshot).toBe('dumbbells');
  });
});
