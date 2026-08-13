import { useTranslation } from 'react-i18next';
import { DurationField, NumberValueField, TextField } from '@/components/ui/Field';
import type { TrackingType } from '@/types';

/**
 * The target values a plan-day exercise and a library-unit exercise both carry.
 * Extracted so the two editors (TemplateExerciseRow, WorkoutUnitExerciseRow)
 * share one tracking-type-discriminated field set and can never drift — the
 * same rep/duration/cardio inputs and the same validation live here once.
 */
export interface ExerciseTargetValues {
  targetSets: number;
  restSeconds: number;
  targetRepMin?: number;
  targetRepMax?: number;
  targetDurationSeconds?: number;
  targetDistanceMeters?: number;
  targetRpe?: number;
  notes: string;
}

export type ExerciseTargetPatch = Partial<ExerciseTargetValues>;

export function ExerciseTargetFields({
  trackingType,
  values,
  onChange,
}: {
  trackingType: TrackingType;
  values: ExerciseTargetValues;
  onChange: (patch: ExerciseTargetPatch) => void;
}) {
  const { t } = useTranslation('library');
  const isCardio = trackingType === 'cardio';
  const isDuration = trackingType === 'duration';

  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <NumberValueField
        label={isCardio ? t('targets.intervals') : t('targets.sets')}
        required
        min={1}
        max={50}
        value={values.targetSets}
        onValueChange={(value) => onChange({ targetSets: value ?? values.targetSets })}
      />
      <NumberValueField
        label={isCardio ? t('targets.intervalRestSeconds') : t('targets.restSeconds')}
        required
        min={0}
        max={3600}
        value={values.restSeconds}
        onValueChange={(value) => onChange({ restSeconds: value ?? values.restSeconds })}
      />

      {isCardio ? (
        <>
          <DurationField
            label={t('targets.duration')}
            containerClassName="col-span-2"
            value={values.targetDurationSeconds}
            onValueChange={(value) => onChange({ targetDurationSeconds: value })}
          />
          <NumberValueField
            label={t('targets.distanceMeters')}
            min={0}
            max={1_000_000}
            value={values.targetDistanceMeters}
            onValueChange={(value) => onChange({ targetDistanceMeters: value })}
          />
          <NumberValueField
            label={t('targets.rpe')}
            decimal
            min={1}
            max={10}
            value={values.targetRpe}
            onValueChange={(value) => onChange({ targetRpe: value })}
          />
        </>
      ) : isDuration ? (
        <DurationField
          label={t('targets.duration')}
          withHours={false}
          containerClassName="col-span-2"
          value={values.targetDurationSeconds}
          onValueChange={(value) => onChange({ targetDurationSeconds: value })}
        />
      ) : (
        <>
          <NumberValueField
            label={t('targets.repsFrom')}
            min={0}
            max={1000}
            value={values.targetRepMin}
            onValueChange={(value) => onChange({ targetRepMin: value })}
          />
          <NumberValueField
            label={t('targets.repsTo')}
            min={0}
            max={1000}
            value={values.targetRepMax}
            onValueChange={(value) => onChange({ targetRepMax: value })}
          />
        </>
      )}

      <TextField
        label={t('targets.note')}
        containerClassName="col-span-2"
        value={values.notes}
        placeholder={t('targets.optional')}
        onChange={(event) => onChange({ notes: event.target.value })}
      />
    </div>
  );
}
