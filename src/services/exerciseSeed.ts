import { db, type TrainingDatabase } from '@/db/db';
import { SYSTEM_EXERCISES } from '@/constants/exerciseCatalog';
import type { Exercise } from '@/types';
import { nowIso, uuid } from '@/utils/id';

/**
 * Idempotently seeds the curated system exercise catalog.
 *
 * A catalog entry is matched by its stable `catalogKey`: if an exercise with
 * that key already exists it is left completely untouched, so a user's edits to
 * a system exercise survive and an app update never creates duplicates. Only
 * missing entries are added, as `origin: 'system'`. Custom exercises (no
 * `catalogKey`) are never inspected or changed, so a same-named user exercise
 * simply coexists with the system one.
 *
 * Safe to call on every app start and after a full reset.
 */
export async function seedSystemExercises(
  database: TrainingDatabase = db,
): Promise<{ added: number; kept: number }> {
  return database.transaction('rw', database.exercises, async () => {
    const existing = await database.exercises.toArray();
    const knownKeys = new Set(
      existing
        .map((exercise) => exercise.catalogKey)
        .filter((key): key is string => !!key),
    );

    const timestamp = nowIso();
    const toAdd: Exercise[] = [];
    for (const def of SYSTEM_EXERCISES) {
      if (knownKeys.has(def.catalogKey)) continue;
      toAdd.push({
        id: uuid(),
        origin: 'system',
        catalogKey: def.catalogKey,
        name: def.name,
        searchTerms: def.searchTerms,
        primaryMuscleGroup: def.primaryMuscleGroup,
        secondaryMuscleGroups: def.secondaryMuscleGroups,
        equipment: def.equipment,
        defaultEquipment: def.defaultEquipment,
        trackingType: def.trackingType,
        cardioModality: def.cardioModality,
        weightMode: def.weightMode,
        weightMultiplier: def.weightMultiplier,
        defaultRestSeconds: def.defaultRestSeconds,
        notes: '',
        archived: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
    if (toAdd.length > 0) await database.exercises.bulkAdd(toAdd);
    return { added: toAdd.length, kept: knownKeys.size };
  });
}
