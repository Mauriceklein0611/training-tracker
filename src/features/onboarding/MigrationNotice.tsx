import { ExternalLink, MoveRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { APP_URL, appOrigin } from '@/config/brand';
import { getLanguage } from '@/i18n';
import { onboarding as deOnboarding } from '@/i18n/locales/de/onboarding';
import { onboarding as enOnboarding } from '@/i18n/locales/en/onboarding';

export function MigrationNotice() {
  if (appOrigin() !== 'legacy') return null;
  const copy = (getLanguage() === 'de' ? deOnboarding : enOnboarding).migration;

  return (
    <aside
      className="mb-4 rounded-2xl border border-warning/50 bg-surface p-4"
      role="note"
    >
      <div className="flex items-start gap-3">
        <MoveRight
          size={22}
          className="mt-0.5 shrink-0 text-warning"
          aria-hidden="true"
        />
        <div>
          <h2 className="font-semibold">{copy.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">{copy.text}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Link
          to="/mehr/daten"
          className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-accent px-4 font-semibold text-accent-contrast"
        >
          {copy.backup}
        </Link>
        <a
          href={APP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-border bg-surface-2 px-4 font-medium"
        >
          {copy.newApp} <ExternalLink size={17} aria-hidden="true" />
        </a>
      </div>
    </aside>
  );
}
