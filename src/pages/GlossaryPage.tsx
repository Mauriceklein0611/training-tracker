import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { GLOSSARY } from '@/constants/glossary';

/**
 * The full glossary — every technical term the app uses, explained in plain
 * language with an example and, where relevant, a caveat. The same wording backs
 * the inline info hints next to terms across the app.
 */
export default function GlossaryPage() {
  return (
    <>
      <PageHeader title="Glossar" backTo="/mehr" />
      <div className="grid gap-3">
        <p className="text-sm leading-relaxed text-muted">
          Kurze, verständliche Erklärungen der Fachbegriffe. Schätzwerte sind als solche
          gekennzeichnet und nie als Messung dargestellt.
        </p>
        {GLOSSARY.map((entry) => (
          <Card key={entry.key}>
            <h2 className="text-base font-semibold">{entry.term}</h2>
            <p className="mt-1 text-sm leading-relaxed">{entry.definition}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              <span className="font-medium text-text">Beispiel: </span>
              {entry.example}
            </p>
            {entry.caveat ? (
              <p className="mt-2 rounded-xl bg-surface-2 p-2 text-xs leading-relaxed text-muted">
                {entry.caveat}
              </p>
            ) : null}
          </Card>
        ))}
      </div>
    </>
  );
}
