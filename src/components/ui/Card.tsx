import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-2xl border border-border bg-surface p-4', className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  as: Heading = 'h2',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  as?: 'h2' | 'h3';
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Heading className="text-base font-semibold leading-tight">{title}</Heading>
        {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * Highlighted key figure. The value is deliberately large and uses tabular
 * numbers so a row of stats stays aligned.
 */
export function Stat({
  label,
  value,
  hint,
  tone = 'default',
  sparkline,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'accent' | 'muted';
  /** Optional trend values for a tiny sparkline under the number (decorative). */
  sparkline?: number[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
      <div
        className={cn(
          'numeric mt-1 text-2xl font-bold leading-none',
          tone === 'accent' && 'text-accent',
          tone === 'muted' && 'text-muted',
        )}
      >
        {value}
      </div>
      {sparkline && sparkline.length > 1 ? <Sparkline values={sparkline} /> : null}
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

/**
 * A tiny inline trend line — decorative (the KPI number carries the meaning), so
 * it is hidden from screen readers. Scales to the value range; a flat series
 * draws a flat line rather than dividing by zero.
 */
function Sparkline({ values }: { values: number[] }) {
  const width = 100;
  const height = 24;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / span) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mt-1.5 h-6 w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function Badge({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: 'default' | 'accent' | 'warning' | 'danger' | 'success';
}) {
  const tones = {
    default: 'bg-surface-2 text-muted border-border',
    accent: 'bg-surface-2 text-accent border-accent/40',
    warning: 'bg-surface-2 text-warning border-warning/40',
    danger: 'bg-surface-2 text-danger border-danger/40',
    success: 'bg-surface-2 text-success border-success/40',
  } as const;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-6 text-center">
      {icon ? <div className="mb-3 flex justify-center text-muted">{icon}</div> : null}
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-prose text-sm leading-relaxed text-muted">
        {description}
      </p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
