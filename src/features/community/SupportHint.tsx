import { useEffect, useRef } from 'react';
import { ExternalLink, Heart, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useToast } from '@/hooks/useToast';
import { KOFI_URL, isConfiguredExternalUrl } from '@/config/externalLinks';
import { shareApp } from '@/features/community/shareApp';

/**
 * Discreet home-screen hint about voluntary support (#32).
 *
 * Rendered only when `services/supportHint.ts` says it may appear (proven
 * usage, 30-day cooldown, never while or on the day of training, never after an
 * opt-out). It is an inline card, never a modal or a recurring banner, offers
 * sharing as an equal alternative, and can be postponed or switched off for
 * good. Showing it records the timestamp once, so the cooldown starts even if
 * the user just scrolls past.
 */
export function SupportHint({
  kofiUrl = KOFI_URL,
  onShown,
  onLater,
  onDismiss,
}: {
  kofiUrl?: string;
  onShown: () => void;
  onLater: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation('community');
  const { t: tCommon } = useTranslation();
  const online = useOnlineStatus();
  const toast = useToast();
  const reported = useRef(false);

  useEffect(() => {
    // Guarded so React's double-invoked effects in development (and any
    // re-render) cannot write the timestamp twice.
    if (reported.current) return;
    reported.current = true;
    onShown();
  }, [onShown]);

  const share = async () => {
    const result = await shareApp({ title: t('share.title'), text: t('share.text') });
    if (result === 'copied') toast.show(t('share.copied'), 'success');
    if (result === 'unavailable') toast.show(t('share.unavailable'), 'error');
  };

  return (
    <Card className="mb-4">
      <h2 className="text-sm font-semibold">{t('hint.title')}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{t('hint.text')}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {isConfiguredExternalUrl(kofiUrl) && online ? (
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
        <Button variant="secondary" onClick={() => void share()}>
          <Share2 size={18} aria-hidden="true" />
          {t('project.share')}
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={onLater}>
          {tCommon('action.later')}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          {tCommon('action.dismiss')}
        </Button>
      </div>
    </Card>
  );
}
