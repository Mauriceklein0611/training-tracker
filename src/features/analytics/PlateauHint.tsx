import { Lightbulb } from 'lucide-react';
import { plateauMessages, type PlateauAnalysis } from '@/services/plateau';
import { formatDate } from '@/utils/date';

/**
 * A local plateau hint. Rendered with a dashed, clearly non-data styling so it
 * reads as an observation the app offers, never as a stored measurement — and
 * only when there is genuinely something conservative to say.
 */
export function PlateauHint({ analysis }: { analysis: PlateauAnalysis }) {
  const messages = plateauMessages(analysis);
  if (messages.length === 0) return null;

  return (
    <div
      role="note"
      className="mt-3 rounded-2xl border border-dashed border-accent/50 bg-surface-2/50 p-3"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-accent">
        <Lightbulb size={16} aria-hidden="true" />
        Hinweis
      </div>
      <div className="mt-1.5 grid gap-1.5">
        {messages.map((message, index) => (
          <p
            key={index}
            className={index === 0 ? 'text-sm leading-relaxed' : 'text-xs leading-relaxed text-muted'}
          >
            {message}
          </p>
        ))}
      </div>
      {analysis.fromDate && analysis.toDate ? (
        <p className="mt-2 text-xs text-muted">
          Zeitraum: {formatDate(analysis.fromDate)} – {formatDate(analysis.toDate)} ·{' '}
          {analysis.windowSize} Einheiten · Kennzahl: {analysis.metricLabel}
        </p>
      ) : null}
    </div>
  );
}
