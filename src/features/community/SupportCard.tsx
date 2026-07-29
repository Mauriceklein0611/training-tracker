import { ExternalLink, Heart, Share2, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useToast } from '@/hooks/useToast';
import { KOFI_URL, isConfiguredExternalUrl } from '@/config/externalLinks';
import { shareApp } from '@/features/community/shareApp';

/**
 * Standalone project card for the "Mehr" hub (#32): voluntary Ko-fi support and
 * sharing the app offered as equals, in one calm card instead of a settings row
 * that disappears in a long list.
 *
 * Deliberately not a growth pattern: no urgency, no countdown, no pulsing
 * animation, no dark pattern — and never a training CTA. Support is a plain
 * external link (no widget, iframe or SDK), sharing uses the browser's own
 * share sheet with a clipboard fallback and sends no app data anywhere.
 */
export function SupportCard({ kofiUrl = KOFI_URL }: { kofiUrl?: string } = {}) {
  const { t } = useTranslation('community');
  const { t: tCommon } = useTranslation();
  const online = useOnlineStatus();
  const toast = useToast();
  const supportConfigured = isConfiguredExternalUrl(kofiUrl);

  const share = async () => {
    const result = await shareApp({ title: t('share.title'), text: t('share.text') });
    if (result === 'copied') toast.show(t('share.copied'), 'success');
    if (result === 'unavailable') toast.show(t('share.unavailable'), 'error');
  };

  return (
    <Card className="mb-4">
      <h2 className="text-sm font-semibold">{t('project.title')}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{t('project.text')}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {supportConfigured && online ? (
          <a
            href={kofiUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${t('project.support')} — ${tCommon('external.opensInNewTab')}`}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-accent px-4 text-base font-semibold text-accent-contrast active:bg-accent-strong"
          >
            <Heart size={18} aria-hidden="true" />
            {t('project.support')}
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        ) : null}

        {/* Sharing works offline up to the share sheet, so it is always offered. */}
        <Button variant="secondary" onClick={() => void share()}>
          <Share2 size={18} aria-hidden="true" />
          {t('project.share')}
        </Button>
      </div>

      {supportConfigured && !online ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-muted">
          <WifiOff size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          {tCommon('external.offlineHint')}
        </p>
      ) : null}
      <p className="mt-2 text-xs leading-relaxed text-muted">{t('freeNote')}</p>
    </Card>
  );
}
