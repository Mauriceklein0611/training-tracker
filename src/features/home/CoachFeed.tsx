import { Lightbulb } from 'lucide-react';
import type { CoachInsight } from '@/services/coachFeed';

/**
 * A few local, deterministic coach insights. Each shows a "Warum?" disclosure
 * with the calculation basis and timeframe, so nothing reads as an opaque
 * verdict. No diagnosis, no score, no claimed AI.
 */
export function CoachFeed({ insights }: { insights: CoachInsight[] }) {
  if (insights.length === 0) return null;
  return (
    <section aria-labelledby="coach-heading" className="mb-6">
      <h2 id="coach-heading" className="mb-3 text-base font-semibold">
        Hinweise
      </h2>
      <ul className="grid gap-2">
        {insights.map((insight) => (
          <li
            key={insight.id}
            className="rounded-2xl border border-border bg-surface p-3"
          >
            <div className="flex items-start gap-2">
              <Lightbulb
                size={18}
                className={
                  insight.tone === 'attention'
                    ? 'mt-0.5 shrink-0 text-warning'
                    : 'mt-0.5 shrink-0 text-accent'
                }
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm">{insight.text}</p>
                <details className="mt-1">
                  <summary className="min-h-[32px] cursor-pointer list-none py-1 text-xs font-medium text-accent">
                    Warum wird das angezeigt?
                  </summary>
                  <p className="text-xs leading-relaxed text-muted">{insight.why}</p>
                </details>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
