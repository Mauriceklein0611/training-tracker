import { useId, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * Chart building blocks.
 *
 * Design decisions that apply to every chart here:
 * - Exactly one data series per chart. Two measures on two scales in one frame
 *   would be misleading, and on a 390 px screen a second series is unreadable.
 *   Because there is only one series, the heading names it and no legend box is
 *   needed — identity is never carried by colour alone.
 * - The series colour (#0891b2) was validated against both the dark and the
 *   light chart surface for lightness, chroma and ≥3:1 contrast.
 * - Every chart is accompanied by a text summary and a data table, so the
 *   information is available without seeing the graphic at all.
 */

export const SERIES_COLOR = '#0891b2';
const GRID_COLOR = 'color-mix(in oklab, var(--border) 70%, transparent)';
const AXIS_COLOR = 'var(--muted)';

const AXIS_PROPS = {
  stroke: AXIS_COLOR,
  tickLine: false,
  axisLine: false,
  tick: { fill: AXIS_COLOR, fontSize: 11 },
} as const;

interface TooltipEntry {
  value?: number | string;
  payload?: Record<string, unknown>;
}

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  formatter: (value: number, payload: Record<string, unknown>) => string;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const value = typeof entry.value === 'number' ? entry.value : Number(entry.value ?? 0);
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="font-medium">{String(label ?? '')}</p>
      <p className="numeric mt-0.5 text-sm font-semibold">
        {formatter(value, entry.payload ?? {})}
      </p>
    </div>
  );
}

/**
 * Frame around a chart: accessible heading, the graphic itself (hidden from
 * screen readers), a spoken summary, and an optional expandable data table.
 */
export function ChartFrame({
  title,
  summary,
  children,
  table,
  empty,
}: {
  title: string;
  /** One sentence describing the trend — also the screen-reader description. */
  summary: string;
  children: ReactNode;
  table?: ReactNode;
  empty?: boolean;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-border bg-surface p-3">
      <h3 id={id} className="text-sm font-semibold">
        {title}
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-muted">{summary}</p>
      {empty ? (
        <p className="py-6 text-center text-sm text-muted">
          Für diesen Zeitraum liegen keine Daten vor.
        </p>
      ) : (
        <>
          {/* The SVG is decorative: the summary and table carry the information. */}
          <div className="mt-3" aria-hidden="true">
            {children}
          </div>
          {table ? (
            <details className="mt-2">
              <summary className="min-h-[44px] cursor-pointer list-none py-2 text-xs font-medium text-accent">
                Werte als Tabelle anzeigen
              </summary>
              <div className="overflow-x-auto">{table}</div>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}

export interface BarPoint {
  label: string;
  value: number;
}

/** Vertical bars for a value over time (weekly volume, weekly sets). */
export function SimpleBarChart({
  data,
  formatValue,
}: {
  data: BarPoint[];
  formatValue: (value: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={12} />
        <YAxis {...AXIS_PROPS} width={52} tickFormatter={formatValue} />
        <Tooltip
          cursor={{ fill: 'color-mix(in oklab, var(--muted) 15%, transparent)' }}
          content={<ChartTooltip formatter={(value) => formatValue(value)} />}
        />
        <Bar
          dataKey="value"
          fill={SERIES_COLOR}
          // Rounded data-end anchored to the baseline; the gap keeps bars separated.
          radius={[4, 4, 0, 0]}
          barSize={18}
          maxBarSize={28}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bars for comparing categories (working sets per muscle group). */
export function HorizontalBarChart({
  data,
  formatValue,
}: {
  data: BarPoint[];
  formatValue: (value: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 34 + 24)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 12, bottom: 0, left: 4 }}
      >
        <CartesianGrid stroke={GRID_COLOR} horizontal={false} />
        <XAxis type="number" {...AXIS_PROPS} tickFormatter={formatValue} />
        <YAxis type="category" dataKey="label" {...AXIS_PROPS} width={92} />
        <Tooltip
          cursor={{ fill: 'color-mix(in oklab, var(--muted) 15%, transparent)' }}
          content={<ChartTooltip formatter={(value) => formatValue(value)} />}
        />
        <Bar dataKey="value" fill={SERIES_COLOR} radius={[0, 4, 4, 0]} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface LinePoint {
  label: string;
  value: number | null;
}

/** Progression of one metric of one exercise over time. */
export function SimpleLineChart({
  data,
  formatValue,
}: {
  data: LinePoint[];
  formatValue: (value: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID_COLOR} vertical={false} />
        <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={16} />
        <YAxis {...AXIS_PROPS} width={52} tickFormatter={formatValue} domain={['auto', 'auto']} />
        <Tooltip content={<ChartTooltip formatter={(value) => formatValue(value)} />} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={SERIES_COLOR}
          strokeWidth={2}
          // Gaps instead of a drop to zero when a value is not meaningful.
          connectNulls={false}
          dot={{ r: 4, fill: SERIES_COLOR, strokeWidth: 0 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Plain data table shown underneath a chart. */
export function DataTable({
  columns,
  rows,
  caption,
}: {
  columns: string[];
  rows: (string | number)[][];
  caption: string;
}) {
  return (
    <table className="mt-2 w-full text-left text-xs">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="text-muted">
          {columns.map((column) => (
            <th key={column} scope="col" className="whitespace-nowrap py-1 pr-3 font-medium">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index} className="border-t border-border">
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} className="numeric whitespace-nowrap py-1 pr-3">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
