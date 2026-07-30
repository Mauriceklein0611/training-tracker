import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { TALLY_PRIVACY_URL } from '@/config/externalLinks';

const SECTION_KEYS = [
  'local',
  'noServer',
  'noAccount',
  'noTracking',
  'browserData',
  'backups',
  'aiExport',
] as const;

export default function PrivacyPage() {
  const { t } = useTranslation('more');
  return (
    <>
      <PageHeader title={t('screens.privacy.title')} backTo="/mehr" />
      <div className="grid gap-3">
        {SECTION_KEYS.map((key) => (
          <Card key={key}>
            <h2 className="text-sm font-semibold">
              {t(`screens.privacy.sections.${key}.title`)}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {t(`screens.privacy.sections.${key}.text`)}
            </p>
          </Card>
        ))}
        <Card>
          <h2 className="text-sm font-semibold">{t('screens.privacy.communityTitle')}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {t('screens.privacy.communityText')}
          </p>
          <a
            href={TALLY_PRIVACY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 text-sm text-accent"
          >
            {t('screens.privacy.tallyLink')}
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        </Card>
      </div>
    </>
  );
}
