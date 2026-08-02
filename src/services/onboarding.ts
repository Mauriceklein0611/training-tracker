import { db, type TrainingDatabase } from '@/db/db';

export const ONBOARDING_VERSION = 1;
const STORAGE_KEY = 'training-tracker.onboarding';

export interface OnboardingState {
  completed: boolean;
  version: number;
  completedAt?: string;
}

export function readOnboardingState(): OnboardingState | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'completed' in parsed &&
      'version' in parsed &&
      typeof parsed.completed === 'boolean' &&
      typeof parsed.version === 'number'
    ) {
      return parsed as OnboardingState;
    }
  } catch {
    // Corrupt optional UI state behaves like no onboarding state.
  }
  return null;
}

export function completeOnboarding(): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        completed: true,
        version: ONBOARDING_VERSION,
        completedAt: new Date().toISOString(),
      } satisfies OnboardingState),
    );
  } catch {
    // The app remains usable when localStorage is unavailable.
  }
}

export function resetOnboarding(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // The setting is optional.
  }
}

/**
 * System exercises are seeded for every installation, so they do not make a
 * person an existing user. Every table below represents deliberate user data.
 */
export async function hasMeaningfulUserData(
  database: TrainingDatabase = db,
): Promise<boolean> {
  const counts = await Promise.all([
    database.trainingPlans.count(),
    database.workoutTemplates.count(),
    database.workoutSessions.count(),
    database.bodyWeightEntries.count(),
    database.workoutUnitTemplates.count(),
    database.equipmentProfiles.count(),
    database.aiAnalyses.count(),
    database.exercises.filter((exercise) => exercise.origin === 'custom').count(),
  ]);
  return counts.some((count) => count > 0);
}
