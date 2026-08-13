import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TargetSummaryLabels } from '@/features/templates/targetSummary';
import { splitDuration } from '@/services/duration';
import { formatDuration } from '@/utils/date';

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
      // A duration is summarised the way it is now entered: seconds below a
      // minute, otherwise the clock reading the field itself shows.
      duration: (seconds) => {
        if (seconds < 60) return t('summary.duration', { value: seconds });
        const key =
          splitDuration(seconds).hours > 0 ? 'summary.durationHms' : 'summary.durationMs';
        return t(key, { value: formatDuration(seconds) });
      },
      distance: (meters) => t('summary.distance', { value: meters }),
      rpe: (value) => t('summary.rpe', { value }),
      rest: (seconds) => t('summary.rest', { value: seconds }),
      noRest: () => t('summary.noRest'),
    }),
    [t],
  );
}
