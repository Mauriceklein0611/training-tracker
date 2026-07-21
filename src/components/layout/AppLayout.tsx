import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { cn } from '@/utils/cn';

/**
 * App shell.
 *
 * While a workout is being recorded the bottom navigation is hidden: the live
 * view takes over the screen so that entering sets stays the only focus, and
 * leaving happens through explicit actions in that view.
 */
export function AppLayout() {
  const location = useLocation();
  const isLiveSession = location.pathname.startsWith('/training/');

  return (
    <div className="min-h-dvh bg-bg">
      <UpdatePrompt />
      <main
        id="main"
        className={cn(
          'mx-auto w-full max-w-2xl px-4',
          isLiveSession ? 'pb-8' : 'pb-[calc(72px+env(safe-area-inset-bottom,0px))]',
        )}
      >
        {/* A crash inside one screen must not take down the navigation. */}
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      {isLiveSession ? null : <BottomNav />}
    </div>
  );
}
