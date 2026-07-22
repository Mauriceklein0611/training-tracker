import { Lightbulb } from 'lucide-react';
import type { ProgressionSuggestion } from '@/services/progression';
import { formatKg, formatNumber } from '@/utils/format';

/**
 * Shows the local progression suggestion for an exercise.
 *
 * Deliberately styled as advice, not as data: dashed border, a lamp icon and an
 * explicit "Empfehlung" label keep it visually separate from the recorded sets
 * above it. Nothing here is applied automatically — the user decides.
 */
export function ProgressionHint({ suggestion }: { suggestion: ProgressionSuggestion }) {
  const values: string[] = [];
  if (suggestion.suggestedWeightKg != null) {
    values.push(formatKg(suggestion.suggestedWeightKg));
  }
  if (suggestion.suggestedReps != null) {
    values.push(`${formatNumber(suggestion.suggestedReps)} Wdh.`);
  }

  return (
    <section
      aria-label="Empfehlung für das nächste Training"
      className="mt-3 rounded-xl border border-dashed border-border bg-surface-2 p-3"
    >
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <Lightbulb size={14} aria-hidden="true" />
        Empfehlung fürs nächste Mal
      </p>

      <p className="mt-1 text-sm font-medium">{suggestion.headline}</p>

      {values.length > 0 ? (
        <p className="numeric mt-0.5 text-sm text-accent">
          Vorschlag: {values.join(' × ')}
        </p>
      ) : null}

      <p className="mt-1.5 text-xs leading-relaxed text-muted">{suggestion.reason}</p>

      <p className="mt-1.5 text-xs text-muted">
        Nur ein Hinweis aus deinen eigenen Daten — nichts wird automatisch geändert.
      </p>
    </section>
  );
}
