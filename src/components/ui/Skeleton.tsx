import { cn } from '@/utils/cn';

/**
 * Loading placeholder. A calm pulsing surface block; the pulse is disabled by
 * the global prefers-reduced-motion rule. Decorative, so it is hidden from
 * screen readers — the surrounding region carries an aria-busy/role="status".
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('skeleton rounded-xl bg-surface-2', className)}
    />
  );
}

/** A card-shaped skeleton: a title bar and a couple of lines. */
export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="mt-3 h-8 w-2/3" />
      <Skeleton className="mt-2 h-3 w-1/2" />
    </div>
  );
}

/** A small grid of stat skeletons, matching a KPI block. */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2" role="status" aria-label="Wird geladen">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-2xl border border-border bg-surface p-3">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="mt-2 h-6 w-2/3" />
        </div>
      ))}
    </div>
  );
}
