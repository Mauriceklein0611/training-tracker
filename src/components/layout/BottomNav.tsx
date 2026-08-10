import { NavLink } from 'react-router-dom';
import { BarChart3, ClipboardList, History, House, MoreHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';

// Routes stay German — they are stable, bookmarkable URLs, not UI text (#31).
const ITEMS = [
  { to: '/', key: 'nav.home', Icon: House, end: true },
  { to: '/plaene', key: 'nav.plans', Icon: ClipboardList, end: false },
  { to: '/verlauf', key: 'nav.history', Icon: History, end: false },
  { to: '/analyse', key: 'nav.analytics', Icon: BarChart3, end: false },
  { to: '/mehr', key: 'nav.more', Icon: MoreHorizontal, end: false },
] as const;

/** Primary navigation, fixed to the bottom within reach of the thumb. */
export function BottomNav() {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t('nav.label')}
      className="inset-x-safe safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-2xl">
        {ITEMS.map(({ to, key, Icon, end }) => (
          <li key={to} className="min-w-0 flex-1">
            <NavLink
              to={to}
              end={end}
              aria-label={key === 'nav.more' ? t('nav.moreLabel') : undefined}
              className="flex min-h-[56px] min-w-0 flex-col items-center justify-center px-0.5 py-1.5"
            >
              {({ isActive }) => (
                <span
                  className={cn(
                    'flex min-w-0 max-w-full flex-col items-center gap-1 rounded-2xl px-1.5 py-1.5 text-[11px] font-medium transition-colors sm:px-3',
                    // A calm, soft pill marks the active tab — not colour alone.
                    isActive ? 'bg-accent/12 text-accent' : 'text-muted',
                  )}
                >
                  <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} aria-hidden="true" />
                  <span className="max-w-full truncate">{t(key)}</span>
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
