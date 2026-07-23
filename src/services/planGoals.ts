import type { ExperienceLevel, PlanGoalType } from '@/types';

/** German labels for the plan goal types (Phase 3). */
export const PLAN_GOAL_TYPE_LABELS: Record<PlanGoalType, string> = {
  muscle: 'Muskelaufbau',
  strength: 'Kraft',
  fitness: 'Allgemeine Fitness',
  fatloss: 'Fettverlust / Diät',
  maintenance: 'Erhalt',
  custom: 'Individuell',
};

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  beginner: 'Anfänger',
  intermediate: 'Fortgeschritten',
  advanced: 'Erfahren',
};
