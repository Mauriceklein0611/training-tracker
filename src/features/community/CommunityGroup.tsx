import {
  Bug,
  ExternalLink,
  Heart,
  MessageSquarePlus,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import {
  KOFI_URL,
  isConfiguredExternalUrl,
  tallyFeedbackUrl,
} from '@/config/externalLinks';

interface CommunityLink {
  key: string;
  href: string;
  label: string;
  description: string;
  Icon: LucideIcon;
}

/**
 * Community group for the "Mehr" hub: voluntary Ko-fi support (#29) and Tally
 * feedback (#30). Both feedback entries open the same form — the category is
 * picked inside it.
 *
 * Entries are plain external links — no widgets, iframes, SDKs or query
 * parameters carrying app data. A link is only rendered when its public URL is
 * configured (no dead links), and while offline it degrades to a
 * non-interactive row with a clear hint instead of a link that cannot open.
 *
 * The feedback form follows the active language (German form for `de`, English
 * form for `en` and any unsupported language).
 *
 * URLs are injectable for tests; production uses the configured defaults.
 */
export function CommunityGroup({
  kofiUrl = KOFI_URL,
  tallyUrl,
}: { kofiUrl?: string; tallyUrl?: string } = {}) {
  const online = useOnlineStatus();
  const { t, i18n } = useTranslation('community');
  const { t: tCommon } = useTranslation();
  // `??` (not `||`) so an explicitly empty URL stays "not configured".
  const feedbackUrl =
    tallyUrl ?? tallyFeedbackUrl(i18n.resolvedLanguage ?? i18n.language);

  const links: CommunityLink[] = [];
  if (isConfiguredExternalUrl(kofiUrl)) {
    links.push({
      key: 'support',
      href: kofiUrl,
      label: t('support.label'),
      description: t('support.description'),
      Icon: Heart,
    });
  }
  if (isConfiguredExternalUrl(feedbackUrl)) {
    // Both entries deliberately point at the same form (one category picker).
    links.push({
      key: 'feedback',
      href: feedbackUrl,
      label: t('feedback.label'),
      description: t('feedback.description'),
      Icon: MessageSquarePlus,
    });
    links.push({
      key: 'bug',
      href: feedbackUrl,
      label: t('bug.label'),
      description: t('bug.description'),
      Icon: Bug,
    });
  }

  // Nothing configured → render nothing rather than an empty, confusing group.
  if (links.length === 0) return null;

  return (
    <section aria-labelledby="more-community">
      <h2
        id="more-community"
        className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted"
      >
        {t('sectionTitle')}
      </h2>
      <ul className="grid gap-2">
        {links.map((link) =>
          online ? (
            <li key={link.key}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${link.label} — ${tCommon('external.opensInNewTab')}`}
                className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-border bg-surface p-3 active:bg-surface-2"
              >
                <link.Icon
                  size={22}
                  className="shrink-0 text-accent"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{link.label}</span>
                  <span className="block truncate text-sm text-muted">
                    {link.description}
                  </span>
                </span>
                <ExternalLink
                  size={18}
                  className="shrink-0 text-muted"
                  aria-hidden="true"
                />
              </a>
            </li>
          ) : (
            <li key={link.key}>
              <div
                aria-disabled="true"
                className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-border bg-surface p-3 opacity-60"
              >
                <link.Icon size={22} className="shrink-0 text-muted" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{link.label}</span>
                  <span className="block text-sm leading-relaxed text-muted">
                    {tCommon('external.offlineHint')}
                  </span>
                </span>
                <WifiOff size={18} className="shrink-0 text-muted" aria-hidden="true" />
              </div>
            </li>
          ),
        )}
      </ul>
      {online ? (
        <p className="mt-2 text-xs leading-relaxed text-muted">{t('externalHint')}</p>
      ) : null}
      <p className="mt-1 text-xs leading-relaxed text-muted">{t('freeNote')}</p>
    </section>
  );
}
