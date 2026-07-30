import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';

const GLOSSARY_KEYS = [
  'rpe',
  'rir',
  'oneRm',
  'e1rm',
  'volume',
  'workingSet',
  'intensity',
  'deload',
  'pace',
  'restAdherence',
  'muscleGroups',
] as const;

/**
 * The full glossary — every technical term the app uses, explained in plain
 * language with an example and, where relevant, a caveat. The same wording backs
 * the inline info hints next to terms across the app.
 */
export default function GlossaryPage() {
  const { t } = useTranslation('more');
  return (
    <>
      <PageHeader title={t('screens.glossary.title')} backTo="/mehr" />
      <div className="grid gap-3">
        <p className="text-sm leading-relaxed text-muted">
          {t('screens.glossary.intro')}
        </p>
        {GLOSSARY_KEYS.map((key) => {
          const caveat = t(`screens.glossary.entries.${key}.caveat`);
          return (
            <Card key={key}>
              <h2 className="text-base font-semibold">
                {t(`screens.glossary.entries.${key}.term`)}
              </h2>
              <p className="mt-1 text-sm leading-relaxed">
                {t(`screens.glossary.entries.${key}.definition`)}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                <span className="font-medium text-text">
                  {t('screens.glossary.example')}
                </span>
                {t(`screens.glossary.entries.${key}.example`)}
              </p>
              {caveat ? (
                <p className="mt-2 rounded-xl bg-surface-2 p-2 text-xs leading-relaxed text-muted">
                  {caveat}
                </p>
              ) : null}
            </Card>
          );
        })}
      </div>
    </>
  );
}
