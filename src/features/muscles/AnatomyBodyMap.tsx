import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import Body, { type ExtendedBodyPart, type Slug } from 'react-muscle-highlighter';
import {
  buildBodyData,
  isUsedSlug,
  type SlugColors,
} from '@/features/muscles/muscleLibrary';

/**
 * Anatomical muscle map (proof of concept) built on react-muscle-highlighter — a
 * local, MIT-licensed, offline SVG (no network, no images). Highlights an
 * exercise's primary and secondary muscles on a front and back figure.
 *
 * Colour never carries meaning alone: there is a legend and a full textual list
 * of the muscles underneath, so it works for screen readers. Colours are CSS
 * variables, so the figure follows the light/dark theme like the rest of the app.
 */

const COLORS: SlugColors = {
  primary: 'var(--accent)',
  secondary: 'color-mix(in oklab, var(--accent) 42%, var(--surface-2))',
  inactive: 'var(--surface-3)',
};

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span
        className="inline-block h-3 w-3 rounded-full border border-border"
        style={{ background: color }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

function Figure({
  data,
  side,
  label,
  onSelectSlug,
}: {
  data: ExtendedBodyPart[];
  side: 'front' | 'back';
  label: string;
  onSelectSlug?: (slug: Slug) => void;
}) {
  return (
    <div className="text-center">
      {/* The library sizes the <svg> with fixed width/height attributes; the CSS
       * override makes it scale to the column while keeping the aspect ratio. */}
      <div className="mx-auto max-w-[150px] [&_svg]:h-auto [&_svg]:w-full">
        <Body
          data={data}
          side={side}
          gender="male"
          border="var(--border)"
          defaultFill="var(--surface-3)"
          onBodyPartPress={
            onSelectSlug
              ? (part) => {
                  // Only muscles the app maps to are selectable; head/hands etc.
                  // are decorative.
                  if (part.slug && isUsedSlug(part.slug)) onSelectSlug(part.slug);
                }
              : undefined
          }
        />
      </div>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}

export function AnatomyBodyMap({
  primary,
  secondary = [],
  selectedSlug,
  onSelectSlug,
}: {
  primary: string[];
  secondary?: string[];
  /** When set, the muscles become tappable and this one gets a selected outline. */
  selectedSlug?: Slug;
  onSelectSlug?: (slug: Slug) => void;
}) {
  const { t } = useTranslation('analytics');
  const headingId = useId();
  const base = buildBodyData(primary, secondary, COLORS);
  // Outline the selected muscle without changing its fill (styles.stroke only,
  // so getColorToFill still uses the emphasis colour).
  const data: ExtendedBodyPart[] = selectedSlug
    ? base.map((part) =>
        part.slug === selectedSlug
          ? { ...part, styles: { stroke: 'var(--text)', strokeWidth: 4 } }
          : part,
      )
    : base;
  const cleanPrimary = primary.map((m) => m.trim()).filter(Boolean);
  const cleanSecondary = secondary
    .map((m) => m.trim())
    .filter((m) => m && !cleanPrimary.includes(m));

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="sr-only">
        {t('anatomy.heading')}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <Figure
          data={data}
          side="front"
          label={t('anatomy.front')}
          onSelectSlug={onSelectSlug}
        />
        <Figure
          data={data}
          side="back"
          label={t('anatomy.back')}
          onSelectSlug={onSelectSlug}
        />
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        <Swatch color={COLORS.primary} label={t('anatomy.primary')} />
        <Swatch color={COLORS.secondary} label={t('anatomy.secondary')} />
        <Swatch color={COLORS.inactive} label={t('anatomy.inactive')} />
      </div>

      {/* Textual alternative — also carries custom muscle labels with no region. */}
      <dl className="mt-2 grid gap-0.5 text-xs">
        <div className="flex gap-1">
          <dt className="font-medium">{t('anatomy.primary')}:</dt>
          <dd className="text-muted">
            {cleanPrimary.length > 0 ? cleanPrimary.join(', ') : '—'}
          </dd>
        </div>
        {cleanSecondary.length > 0 ? (
          <div className="flex gap-1">
            <dt className="font-medium">{t('anatomy.secondary')}:</dt>
            <dd className="text-muted">{cleanSecondary.join(', ')}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
