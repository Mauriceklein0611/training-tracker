import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TargetSummaryLabels } from '@/features/templates/targetSummary';

/**
 * Localised labels for the collapsed target summary of a plan-day or library
 * exercise. Shared by both editors so the two rows can never word the same
 * summary differently.
 */
export function useTargetSummaryLabels(): TargetSummaryLabels {
  const { t } = useTranslation('library');
  return useMemo(
    () => ({
      sets: (value) => t('summary.sets', { value }),
      intervals: (value) => t('summary.intervals', { value }),
      reps: (min, max) => t('summary.reps', { min, max }),
      repsFrom: (min) => t('summary.repsFrom', { min }),
      repsTo: (max) => t('summary.repsTo', { max }),
      duration: (seconds) => t('summary.duration', { value: seconds }),
      distance: (meters) => t('summary.distance', { value: meters }),
      rpe: (value) => t('summary.rpe', { value }),
      rest: (seconds) => t('summary.rest', { value: seconds }),
      noRest: () => t('summary.noRest'),
    }),
    [t],
  );
}
