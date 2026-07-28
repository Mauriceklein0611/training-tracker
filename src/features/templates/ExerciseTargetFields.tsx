import { NumberField, TextField } from '@/components/ui/Field';
import { parseNumberInput } from '@/services/validation';
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

/** Rounded non-negative integer, or undefined for an empty field. */
function optInt(raw: string): number | undefined {
  const parsed = parseNumberInput(raw);
  return parsed == null ? undefined : Math.max(0, Math.round(parsed));
}

/** Rounded non-negative number (metres), or undefined for an empty field. */
function optDistance(raw: string): number | undefined {
  const parsed = parseNumberInput(raw);
  return parsed == null ? undefined : Math.max(0, Math.round(parsed));
}

/** RPE clamped to 1–10, or undefined for an empty field. */
function optRpe(raw: string): number | undefined {
  const parsed = parseNumberInput(raw);
  if (parsed == null) return undefined;
  return Math.min(10, Math.max(1, parsed));
}

export function ExerciseTargetFields({
  trackingType,
  values,
  onChange,
}: {
  trackingType: TrackingType;
  values: ExerciseTargetValues;
  onChange: (patch: ExerciseTargetPatch) => void;
}) {
  const isCardio = trackingType === 'cardio';
  const isDuration = trackingType === 'duration';

  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <NumberField
        label={isCardio ? 'Intervalle' : 'Sätze'}
        value={String(values.targetSets)}
        onChange={(event) =>
          onChange({
            targetSets: Math.max(
              1,
              Math.round(parseNumberInput(event.target.value) ?? 1),
            ),
          })
        }
      />
      <NumberField
        label={isCardio ? 'Pause zw. Intervallen (s)' : 'Pause (s)'}
        value={String(values.restSeconds)}
        onChange={(event) =>
          onChange({
            restSeconds: Math.max(
              0,
              Math.round(parseNumberInput(event.target.value) ?? 0),
            ),
          })
        }
      />

      {isCardio ? (
        <>
          <NumberField
            label="Zieldauer (s)"
            value={String(values.targetDurationSeconds ?? '')}
            onChange={(event) =>
              onChange({ targetDurationSeconds: optInt(event.target.value) })
            }
          />
          <NumberField
            label="Zieldistanz (m)"
            value={String(values.targetDistanceMeters ?? '')}
            onChange={(event) =>
              onChange({ targetDistanceMeters: optDistance(event.target.value) })
            }
          />
          <NumberField
            label="Ziel-RPE (1–10)"
            decimal
            containerClassName="col-span-2"
            value={String(values.targetRpe ?? '')}
            onChange={(event) => onChange({ targetRpe: optRpe(event.target.value) })}
          />
        </>
      ) : isDuration ? (
        <NumberField
          label="Zieldauer (s)"
          containerClassName="col-span-2"
          value={String(values.targetDurationSeconds ?? '')}
          onChange={(event) =>
            onChange({ targetDurationSeconds: optInt(event.target.value) })
          }
        />
      ) : (
        <>
          <NumberField
            label="Wdh. von"
            value={String(values.targetRepMin ?? '')}
            onChange={(event) => onChange({ targetRepMin: optInt(event.target.value) })}
          />
          <NumberField
            label="Wdh. bis"
            value={String(values.targetRepMax ?? '')}
            onChange={(event) => onChange({ targetRepMax: optInt(event.target.value) })}
          />
        </>
      )}

      <TextField
        label="Notiz"
        containerClassName="col-span-2"
        value={values.notes}
        placeholder="Optional"
        onChange={(event) => onChange({ notes: event.target.value })}
      />
    </div>
  );
}
