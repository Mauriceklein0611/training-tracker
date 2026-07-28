import { useState } from 'react';
import { Info } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { GLOSSARY_BY_KEY } from '@/constants/glossary';

/**
 * A small info button next to a technical term. Tapping (or activating by
 * keyboard) opens an accessible popover with the term's plain-language
 * explanation from the central glossary — the same wording everywhere. Works by
 * click/focus, so it is reachable on touch as well as with a mouse or keyboard,
 * unlike a hover-only tooltip.
 */
export function InfoHint({ term }: { term: string }) {
  const [open, setOpen] = useState(false);
  const entry = GLOSSARY_BY_KEY[term];
  if (!entry) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Was bedeutet ${entry.term}?`}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted hover:text-accent focus-visible:text-accent"
      >
        <Info size={15} aria-hidden="true" />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={entry.term}>
        <div className="grid gap-2 text-sm leading-relaxed">
          <p>{entry.definition}</p>
          <p className="text-muted">
            <span className="font-medium text-text">Beispiel: </span>
            {entry.example}
          </p>
          {entry.caveat ? (
            <p className="rounded-xl bg-surface-2 p-2 text-xs text-muted">
              {entry.caveat}
            </p>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
