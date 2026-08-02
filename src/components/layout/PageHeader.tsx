import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '@/components/ui/Button';
import type { ReactNode } from 'react';

/** Sticky screen header with an optional back button and one action slot. */
export function PageHeader({
  title,
  subtitle,
  backTo,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  /** Route to go back to; omit for top-level screens. */
  backTo?: string;
  action?: ReactNode;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <header className="header-safe sticky top-0 z-30 -mx-4 mb-4 border-b border-border bg-bg/95 px-4 pb-3 backdrop-blur">
      <div className="flex items-center gap-2">
        {backTo ? (
          <IconButton
            label={t('action.back')}
            onClick={() => navigate(backTo)}
            className="-ml-2 shrink-0"
          >
            <ChevronLeft size={24} aria-hidden="true" />
          </IconButton>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-xl font-bold leading-tight">{title}</h1>
          {subtitle ? (
            <p className="mt-0.5 text-sm leading-snug text-muted">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
