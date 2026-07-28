/**
 * Local share card — a result graphic rendered entirely on the device.
 *
 * The SVG is built from a small, explicit input so the caller controls exactly
 * what appears (and can leave out anything sensitive — body weight and measures
 * are never part of it). No network, no external fonts or images: system fonts
 * only, self-contained markup. Rasterising and sharing happen elsewhere; this
 * module is a pure string builder so it stays testable.
 */

export interface ShareCardStat {
  label: string;
  value: string;
}

export interface ShareCardInput {
  title: string;
  subtitle?: string;
  stats: ShareCardStat[];
  /** Optional highlight line, e.g. a personal best. */
  highlight?: string;
  /** Accent colour (hex). Defaults to the app's cyan. */
  accent?: string;
}

/** Escapes the five XML special characters so any user text is safe in markup. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const SHARE_CARD_SIZE = 1080;

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/**
 * A square (1080×1080) result card. Up to four stats are laid out in a 2×2 grid;
 * extra stats are ignored so the card never overflows. Everything is inline.
 */
export function buildShareCardSvg(input: ShareCardInput): string {
  const accent = input.accent ?? '#22d3ee';
  const stats = input.stats.slice(0, 4);
  const size = SHARE_CARD_SIZE;

  const statCells = stats
    .map((stat, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = 90 + col * 470;
      const y = 560 + row * 200;
      return `
    <g transform="translate(${x} ${y})">
      <rect width="430" height="170" rx="24" fill="#131a22" stroke="#2b3947" />
      <text x="32" y="62" font-family="${FONT}" font-size="30" fill="#94a3b8">${escapeXml(
        stat.label,
      )}</text>
      <text x="32" y="122" font-family="${FONT}" font-size="58" font-weight="700" fill="#f1f5f9">${escapeXml(
        stat.value,
      )}</text>
    </g>`;
    })
    .join('');

  const highlight = input.highlight
    ? `
  <g transform="translate(90 ${560 + Math.ceil(stats.length / 2) * 200 + 20})">
    <rect width="900" height="96" rx="24" fill="${accent}" opacity="0.15" />
    <text x="40" y="60" font-family="${FONT}" font-size="38" font-weight="600" fill="${accent}">★ ${escapeXml(
      input.highlight,
    )}</text>
  </g>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="0%" r="90%">
      <stop offset="0%" stop-color="#132635" />
      <stop offset="60%" stop-color="#0b0f14" />
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)" />
  <rect x="40" y="40" width="${size - 80}" height="${size - 80}" rx="40" fill="none" stroke="#1b2530" stroke-width="2" />
  <text x="90" y="180" font-family="${FONT}" font-size="44" font-weight="600" fill="${accent}">Training Tracker</text>
  <text x="90" y="320" font-family="${FONT}" font-size="88" font-weight="800" fill="#f1f5f9">${escapeXml(
    input.title,
  )}</text>
  ${
    input.subtitle
      ? `<text x="90" y="392" font-family="${FONT}" font-size="40" fill="#94a3b8">${escapeXml(
          input.subtitle,
        )}</text>`
      : ''
  }
  ${statCells}
  ${highlight}
</svg>`;
}

/** The SVG as a data URL, usable directly as an <img> preview source. */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Rasterises an SVG string to a PNG blob via an offscreen canvas. Browser-only
 * (needs Image + canvas); resolves to a PNG the size of the card.
 */
export function svgToPngBlob(svg: string, size = SHARE_CARD_SIZE): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas nicht verfügbar.'));
      ctx.drawImage(image, 0, 0, size, size);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Bild konnte nicht erzeugt werden.'));
      }, 'image/png');
    };
    image.onerror = () => reject(new Error('Bild konnte nicht gerendert werden.'));
    image.src = svgDataUrl(svg);
  });
}

export type ShareImageOutcome = 'shared' | 'downloaded' | 'cancelled' | 'failed';

/**
 * Offers a PNG to the OS share sheet (Web Share API with files), falling back to
 * a plain download. Must be called from a user gesture. Nothing is uploaded by
 * the app — the OS handles any transfer, and there is never a public URL.
 */
export async function shareImage(
  blob: Blob,
  fileName: string,
  text?: string,
): Promise<ShareImageOutcome> {
  const file = new File([blob], fileName, { type: 'image/png' });
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };

  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError')
        return 'cancelled';
      // Fall through to the download path on any other failure.
    }
  }

  try {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
