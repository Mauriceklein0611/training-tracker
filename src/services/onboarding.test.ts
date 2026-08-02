import { beforeEach, describe, expect, it } from 'vitest';
import { createExercise } from '@/db/repositories/exercises';
import { resetDatabase } from '@/tests/dbTestUtils';
import {
  ONBOARDING_VERSION,
  completeOnboarding,
  hasMeaningfulUserData,
  readOnboardingState,
  resetOnboarding,
} from '@/services/onboarding';

beforeEach(async () => {
  localStorage.clear();
  await resetDatabase();
});

describe('onboarding state', () => {
  it('persists completion with an independent onboarding version', () => {
    expect(readOnboardingState()).toBeNull();
    completeOnboarding();
    expect(readOnboardingState()).toMatchObject({
      completed: true,
      version: ONBOARDING_VERSION,
    });
    resetOnboarding();
    expect(readOnboardingState()).toBeNull();
  });

  it('does not treat a fresh database as an existing user', async () => {
    expect(await hasMeaningfulUserData()).toBe(false);
  });

  it('recognises custom user data without relying on system exercises', async () => {
    await createExercise({
      name: 'Eigene Übung',
      primaryMuscleGroup: 'Brust',
      secondaryMuscleGroups: [],
      equipment: 'Eigenbau',
      trackingType: 'weight_reps',
      weightMode: 'total',
      weightMultiplier: 1,
      defaultRestSeconds: 90,
      notes: '',
    });
    expect(await hasMeaningfulUserData()).toBe(true);
  });
});
