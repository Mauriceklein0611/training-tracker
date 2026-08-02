import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MigrationNotice } from '@/features/onboarding/MigrationNotice';
import { OnboardingDialog } from '@/features/onboarding/OnboardingDialog';
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
    // The horizontal inset shifts the whole column, so the header's edge-to-edge
    // bleed (-mx-4 / px-4) keeps lining up with the content.
    <div className="inset-x-safe min-h-dvh bg-bg">
      <UpdatePrompt />
      {isLiveSession ? null : <OnboardingDialog />}
      <main
        id="main"
        className={cn(
          // overflow-x: clip stops a single too-wide child from spawning a
          // horizontal scrollbar (the "jitter") without turning the column into
          // a scroll container, so the sticky header keeps working.
          'mx-auto w-full max-w-2xl overflow-x-clip px-4',
          isLiveSession ? 'pb-8' : 'pb-[calc(72px+env(safe-area-inset-bottom,0px))]',
        )}
      >
        {isLiveSession ? null : <MigrationNotice />}
        {/* A crash inside one screen must not take down the navigation. */}
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      {isLiveSession ? null : <BottomNav />}
    </div>
  );
}
