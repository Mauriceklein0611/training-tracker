import { describe, expect, it } from 'vitest';
import { workoutProgress, type WorkoutProgressEntry } from '@/services/sessionProgress';

const set = (completed: boolean, setType: 'working' | 'warmup' = 'working') => ({
  completedAt: completed ? '2026-07-28T10:00:00.000Z' : undefined,
  setType,
});

describe('workoutProgress', () => {
  it('counts an exercise done when its working-set goal is reached', () => {
    const entries: WorkoutProgressEntry[] = [
      { targetSets: 3, sets: [set(true), set(true), set(true)] }, // done
      { targetSets: 3, sets: [set(true), set(false)] }, // not yet
    ];
    expect(workoutProgress(entries)).toEqual({ doneExercises: 1, totalExercises: 2 });
  });

  it('ignores warm-up sets towards the goal', () => {
    const entries: WorkoutProgressEntry[] = [
      { targetSets: 2, sets: [set(true, 'warmup'), set(true), set(true)] },
    ];
    expect(workoutProgress(entries).doneExercises).toBe(1);
  });

  it('counts an exercise the user finished by hand as done', () => {
    const entries: WorkoutProgressEntry[] = [
      {
        targetSets: 4,
        finishedAt: '2026-08-13T10:00:00.000Z',
        sets: [set(true), set(true), set(true)], // 3 of 4, ended by the user
      },
      { targetSets: 4, sets: [set(true), set(true), set(true)] },
    ];
    expect(workoutProgress(entries)).toEqual({ doneExercises: 1, totalExercises: 2 });
  });

  it('treats a single completed set as done when there is no goal', () => {
    const entries: WorkoutProgressEntry[] = [
      { sets: [set(true)] },
      { sets: [set(false)] },
    ];
    expect(workoutProgress(entries)).toEqual({ doneExercises: 1, totalExercises: 2 });
  });
});
