import { NavLink } from 'react-router-dom';
import { BarChart3, ClipboardList, Dumbbell, History, MoreHorizontal } from 'lucide-react';
import { cn } from '@/utils/cn';

const ITEMS = [
  { to: '/', label: 'Training', Icon: Dumbbell, end: true },
  { to: '/plaene', label: 'Pläne', Icon: ClipboardList, end: false },
  { to: '/verlauf', label: 'Verlauf', Icon: History, end: false },
  { to: '/analyse', label: 'Analyse', Icon: BarChart3, end: false },
  { to: '/mehr', label: 'Mehr', Icon: MoreHorizontal, end: false },
];

/** Primary navigation, fixed to the bottom within reach of the thumb. */
export function BottomNav() {
  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur safe-bottom"
    >
      <ul className="mx-auto flex max-w-2xl">
        {ITEMS.map(({ to, label, Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors',
                  isActive ? 'text-accent' : 'text-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} aria-hidden="true" />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
