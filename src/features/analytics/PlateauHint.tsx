import { Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PlateauAnalysis } from '@/services/plateau';
import { formatDate } from '@/utils/date';

/**
 * A local plateau hint. Rendered with a dashed, clearly non-data styling so it
 * reads as an observation the app offers, never as a stored measurement — and
 * only when there is genuinely something conservative to say.
 */
export function PlateauHint({ analysis }: { analysis: PlateauAnalysis }) {
  const { t } = useTranslation('analytics');
  if (
    (analysis.status !== 'plateau' && analysis.status !== 'regress') ||
    !analysis.metric
  ) {
    return null;
  }
  const metric = t(`plateau.metric.${analysis.metric}`);
  const messages = [
    t(analysis.status === 'regress' ? 'plateau.regress' : 'plateau.flat', {
      count: analysis.windowSize,
      metric,
    }),
    t('plateau.caveat'),
  ];

  return (
    <div
      role="note"
      className="mt-3 rounded-2xl border border-dashed border-accent/50 bg-surface-2/50 p-3"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-accent">
        <Lightbulb size={16} aria-hidden="true" />
        {t('plateau.title')}
      </div>
      <div className="mt-1.5 grid gap-1.5">
        {messages.map((message, index) => (
          <p
            key={index}
            className={
              index === 0
                ? 'text-sm leading-relaxed'
                : 'text-xs leading-relaxed text-muted'
            }
          >
            {message}
          </p>
        ))}
      </div>
      {analysis.fromDate && analysis.toDate ? (
        <p className="mt-2 text-xs text-muted">
          {t('plateau.period', {
            from: formatDate(analysis.fromDate),
            to: formatDate(analysis.toDate),
            count: analysis.windowSize,
            metric,
          })}
        </p>
      ) : null}
    </div>
  );
}
