import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';

const GLOSSARY_KEYS = {
  rpe: 'rpe',
  rir: 'rir',
  '1rm': 'oneRm',
  e1rm: 'e1rm',
  volume: 'volume',
  workingSet: 'workingSet',
  intensity: 'intensity',
  deload: 'deload',
  pace: 'pace',
  restAdherence: 'restAdherence',
  muscleGroups: 'muscleGroups',
} as const;

/**
 * A small info button next to a technical term. Tapping (or activating by
 * keyboard) opens an accessible popover with the term's plain-language
 * explanation from the central glossary — the same wording everywhere. Works by
 * click/focus, so it is reachable on touch as well as with a mouse or keyboard,
 * unlike a hover-only tooltip.
 */
export function InfoHint({ term }: { term: string }) {
  const { t } = useTranslation('more');
  const [open, setOpen] = useState(false);
  const key = GLOSSARY_KEYS[term as keyof typeof GLOSSARY_KEYS];
  if (!key) return null;
  const title = t(`screens.glossary.entries.${key}.term`);
  const caveat = t(`screens.glossary.entries.${key}.caveat`);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('screens.glossary.whatMeans', { term: title })}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted hover:text-accent focus-visible:text-accent"
      >
        <Info size={15} aria-hidden="true" />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title}>
        <div className="grid gap-2 text-sm leading-relaxed">
          <p>{t(`screens.glossary.entries.${key}.definition`)}</p>
          <p className="text-muted">
            <span className="font-medium text-text">{t('screens.glossary.example')}</span>
            {t(`screens.glossary.entries.${key}.example`)}
          </p>
          {caveat ? (
            <p className="rounded-xl bg-surface-2 p-2 text-xs text-muted">{caveat}</p>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
