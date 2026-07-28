import type { AnalyticsDataset } from '@/services/analytics';
import { buildSetContexts } from '@/services/analytics';
import { effectiveSetExecution, equipmentLabel } from '@/services/equipment';
import { isCompleted } from '@/services/metrics';
import { WEIGHT_MODE_LABELS } from '@/utils/format';

/**
 * The distinct execution variants an exercise was actually performed with
 * (equipment + weight convention), most frequent first. Reads each set's own
 * effective execution, so a temporary switch (e.g. dumbbells for one session)
 * shows up as its own variant and history stays truthful.
 */
export function distinctExerciseVariants(
  dataset: AnalyticsDataset,
  exerciseId: string,
): string[] {
  const counts = new Map<string, number>();
  for (const context of buildSetContexts(dataset)) {
    if (context.sessionExercise.exerciseId !== exerciseId) continue;
    if (!isCompleted(context.set)) continue;
    const execution = effectiveSetExecution(context.set, context.sessionExercise);
    const equipment =
      execution.equipment === 'unspecified' ? '' : equipmentLabel(execution.equipment);
    const mode = WEIGHT_MODE_LABELS[execution.weightMode];
    const parts = [equipment, execution.weightMode === 'total' ? '' : mode].filter(
      Boolean,
    );
    const label = parts.length > 0 ? parts.join(' · ') : mode;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'))
    .map(([label]) => label);
}
