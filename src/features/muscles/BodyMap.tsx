import { useId } from 'react';
import {
  BODY_REGIONS,
  regionForMuscle,
  type BodyRegion,
  type BodyView,
  type RegionShape,
} from '@/features/muscles/muscleRegions';

/**
 * Local, accessible muscle map.
 *
 * Highlights an exercise's primary and secondary muscles on a schematic front
 * and back figure. Information is never carried by colour alone: there is a
 * legend, a `<title>` per region, and a full textual list of the highlighted
 * muscles underneath, so it works for screen readers and in both themes. No
 * external images and no medical claim — an at-a-glance overview only.
 */

export type Emphasis = 'primary' | 'secondary' | 'none';

const FILL: Record<Emphasis, string> = {
  primary: 'var(--accent)',
  secondary: 'color-mix(in oklab, var(--accent) 42%, var(--surface-2))',
  none: 'var(--surface-3)',
};

const FULL_BODY = 'Ganzkörper';

/** The emphasis for each region id, primary winning over secondary. */
function emphasisByRegion(primary: string[], secondary: string[]): Map<string, Emphasis> {
  const map = new Map<string, Emphasis>();
  const allRegionIds = BODY_REGIONS.map((region) => region.id);

  const apply = (labels: string[], level: Emphasis) => {
    for (const label of labels) {
      if (label.trim() === FULL_BODY) {
        for (const id of allRegionIds) {
          if (level === 'primary' || !map.has(id)) map.set(id, level);
        }
        continue;
      }
      const id = regionForMuscle(label);
      if (!id) continue;
      if (level === 'primary' || !map.has(id)) map.set(id, level);
    }
  };

  apply(secondary, 'secondary');
  apply(primary, 'primary'); // primary applied last so it wins
  return map;
}

function Shape({ shape, fill }: { shape: RegionShape; fill: string }) {
  if (shape.kind === 'ellipse') {
    return (
      <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} fill={fill} />
    );
  }
  return (
    <rect
      x={shape.x}
      y={shape.y}
      width={shape.w}
      height={shape.h}
      rx={shape.r ?? 3}
      fill={fill}
    />
  );
}

/** Faint humanoid silhouette so the regions read as a body (decorative). */
const SILHOUETTE: RegionShape[] = [
  { kind: 'ellipse', cx: 50, cy: 14, rx: 7, ry: 8 },
  { kind: 'rect', x: 37, y: 28, w: 26, h: 54, r: 10 },
  { kind: 'rect', x: 17, y: 42, w: 8, h: 28, r: 4 },
  { kind: 'rect', x: 75, y: 42, w: 8, h: 28, r: 4 },
  { kind: 'rect', x: 14, y: 66, w: 7, h: 26, r: 4 },
  { kind: 'rect', x: 79, y: 66, w: 7, h: 26, r: 4 },
  { kind: 'rect', x: 38, y: 80, w: 24, h: 14, r: 6 },
  { kind: 'rect', x: 38, y: 92, w: 10, h: 44, r: 5 },
  { kind: 'rect', x: 52, y: 92, w: 10, h: 44, r: 5 },
  { kind: 'rect', x: 39, y: 134, w: 8, h: 46, r: 4 },
  { kind: 'rect', x: 53, y: 134, w: 8, h: 46, r: 4 },
];

function Figure({
  view,
  emphasis,
  title,
}: {
  view: BodyView;
  emphasis: Map<string, Emphasis>;
  title: string;
}) {
  const regions = BODY_REGIONS.filter((region: BodyRegion) => region.view === view);
  return (
    <svg
      viewBox="0 0 100 190"
      className="h-auto w-full max-w-[150px]"
      role="img"
      aria-label={title}
    >
      <g fill="var(--surface-2)" stroke="var(--border)" strokeWidth={0.6}>
        {SILHOUETTE.map((shape, index) => (
          <Shape key={index} shape={shape} fill="var(--surface-2)" />
        ))}
      </g>
      {regions.map((region) => {
        const level = emphasis.get(region.id) ?? 'none';
        if (level === 'none') return null;
        return (
          <g key={region.id}>
            <title>{region.label}</title>
            {region.shapes.map((shape, index) => (
              <Shape key={index} shape={shape} fill={FILL[level]} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function Swatch({ level, label }: { level: Emphasis; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span
        className="inline-block h-3 w-3 rounded-full border border-border"
        style={{ background: FILL[level] }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

export function BodyMap({
  primary,
  secondary = [],
}: {
  primary: string[];
  secondary?: string[];
}) {
  const headingId = useId();
  const emphasis = emphasisByRegion(primary, secondary);
  const cleanPrimary = primary.map((m) => m.trim()).filter(Boolean);
  const cleanSecondary = secondary
    .map((m) => m.trim())
    .filter((m) => m && !cleanPrimary.includes(m));

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="sr-only">
        Beteiligte Muskelgruppen
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center">
          <Figure view="front" emphasis={emphasis} title="Vorderansicht" />
          <p className="mt-1 text-xs text-muted">Vorne</p>
        </div>
        <div className="text-center">
          <Figure view="back" emphasis={emphasis} title="Rückansicht" />
          <p className="mt-1 text-xs text-muted">Hinten</p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        <Swatch level="primary" label="Primär" />
        <Swatch level="secondary" label="Sekundär" />
        <Swatch level="none" label="Nicht beteiligt" />
      </div>

      {/* Textual alternative — also carries custom muscle labels with no region. */}
      <dl className="mt-2 grid gap-0.5 text-xs">
        <div className="flex gap-1">
          <dt className="font-medium">Primär:</dt>
          <dd className="text-muted">
            {cleanPrimary.length > 0 ? cleanPrimary.join(', ') : '—'}
          </dd>
        </div>
        {cleanSecondary.length > 0 ? (
          <div className="flex gap-1">
            <dt className="font-medium">Sekundär:</dt>
            <dd className="text-muted">{cleanSecondary.join(', ')}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
