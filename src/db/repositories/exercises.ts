import { db } from '@/db/db';
import type { Exercise } from '@/types';
import { nowIso, uuid } from '@/utils/id';

export type ExerciseDraft = Omit<
  Exercise,
  'id' | 'createdAt' | 'updatedAt' | 'archived'
> &
  Partial<Pick<Exercise, 'archived'>>;

export async function listExercises(): Promise<Exercise[]> {
  const all = await db.exercises.toArray();
  return all.sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

export async function listActiveExercises(): Promise<Exercise[]> {
  return (await listExercises()).filter((exercise) => !exercise.archived);
}

export async function getExercise(id: string): Promise<Exercise | undefined> {
  return db.exercises.get(id);
}

export async function createExercise(draft: ExerciseDraft): Promise<Exercise> {
  const timestamp = nowIso();
  const exercise: Exercise = {
    ...draft,
    archived: draft.archived ?? false,
    id: uuid(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.exercises.add(exercise);
  return exercise;
}

export async function updateExercise(
  id: string,
  changes: Partial<ExerciseDraft>,
): Promise<void> {
  await db.exercises.update(id, { ...changes, updatedAt: nowIso() });
}

export async function setExerciseArchived(id: string, archived: boolean): Promise<void> {
  await db.exercises.update(id, { archived, updatedAt: nowIso() });
}

/** True when the exercise appears in at least one recorded session. */
export async function isExerciseInUse(id: string): Promise<boolean> {
  const count = await db.sessionExercises.where('exerciseId').equals(id).count();
  return count > 0;
}

export class ExerciseInUseError extends Error {
  constructor() {
    super(
      'Diese Übung wurde bereits in einer Trainingseinheit verwendet und kann ' +
        'deshalb nicht gelöscht werden. Archiviere sie stattdessen.',
    );
    this.name = 'ExerciseInUseError';
  }
}

/**
 * Deletes an exercise permanently.
 * Refuses to run when history references it — that data must stay intact.
 */
export async function deleteExercise(id: string): Promise<void> {
  await db.transaction(
    'rw',
    db.exercises,
    db.sessionExercises,
    db.templateExercises,
    async () => {
      const used = await db.sessionExercises.where('exerciseId').equals(id).count();
      if (used > 0) throw new ExerciseInUseError();
      await db.templateExercises.where('exerciseId').equals(id).delete();
      await db.exercises.delete(id);
    },
  );
}

/** Distinct muscle groups / equipment values, for filter dropdowns. */
export function collectFilterValues(exercises: Exercise[]): {
  muscleGroups: string[];
  equipment: string[];
} {
  const muscleGroups = new Set<string>();
  const equipment = new Set<string>();
  for (const exercise of exercises) {
    if (exercise.primaryMuscleGroup) muscleGroups.add(exercise.primaryMuscleGroup);
    exercise.secondaryMuscleGroups.forEach((group) => group && muscleGroups.add(group));
    if (exercise.equipment) equipment.add(exercise.equipment);
  }
  return {
    muscleGroups: [...muscleGroups].sort((a, b) => a.localeCompare(b, 'de')),
    equipment: [...equipment].sort((a, b) => a.localeCompare(b, 'de')),
  };
}

/** Case-insensitive search over name, muscle groups and equipment. */
export function filterExercises(
  exercises: Exercise[],
  options: {
    search?: string;
    muscleGroup?: string;
    equipment?: string;
    showArchived?: boolean;
  },
): Exercise[] {
  const search = options.search?.trim().toLowerCase() ?? '';
  return exercises.filter((exercise) => {
    if (!options.showArchived && exercise.archived) return false;
    if (options.muscleGroup && options.muscleGroup !== exercise.primaryMuscleGroup) {
      if (!exercise.secondaryMuscleGroups.includes(options.muscleGroup)) return false;
    }
    if (options.equipment && exercise.equipment !== options.equipment) return false;
    if (!search) return true;
    const haystack = [
      exercise.name,
      exercise.primaryMuscleGroup,
      exercise.equipment,
      ...exercise.secondaryMuscleGroups,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(search);
  });
}
