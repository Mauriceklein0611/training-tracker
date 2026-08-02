/**
 * Generates the PWA PNG icons locally, without any image dependency.
 *
 * Everything is drawn with plain pixel math and encoded with Node's built-in
 * zlib, which keeps the project free of binary assets and extra packages.
 *
 * Run with:  node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const BG = [11, 15, 20]; // #0b0f14 — app background / theme colour
const FG = [34, 211, 238]; // #22d3ee — accent
const FG_MID = [52, 211, 153]; // #34d399 — evolution / progress
const FG_DIM = [14, 165, 233]; // #0ea5e9 — depth

/** CRC-32 as required by the PNG specification. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Encodes RGBA pixel data as a PNG buffer. */
function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // filter type: none
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Rounded-rectangle coverage test in normalised (0..1) coordinates. */
function insideRoundedRect(x, y, rect) {
  const [x0, y0, x1, y1, r] = rect;
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/**
 * Exerivo "E" glyph, described as rounded rectangles in a 0..1 box.
 * `scale` shrinks the glyph towards the centre (used for maskable safe zones).
 */
function glyphShapes(scale) {
  const s = (v) => 0.5 + (v - 0.5) * scale;
  const rect = (x0, y0, x1, y1, r, color) => ({
    rect: [s(x0), s(y0), s(x1), s(y1), r * scale],
    color,
  });
  return [
    rect(0.21, 0.19, 0.34, 0.81, 0.065, FG), // stem
    rect(0.3, 0.2, 0.79, 0.33, 0.065, FG), // top
    rect(0.3, 0.435, 0.69, 0.565, 0.065, FG_MID), // middle
    rect(0.3, 0.67, 0.79, 0.8, 0.065, FG_DIM), // bottom
  ];
}

/**
 * Renders one icon. `maskable` fills the whole canvas with the background and
 * shrinks the glyph into the safe zone; otherwise a rounded app-tile is drawn.
 */
function renderIcon(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const shapes = glyphShapes(maskable ? 0.72 : 1);
  const tile = [0.0, 0.0, 1.0, 1.0, maskable ? 0 : 0.22];
  const ss = 3; // supersampling factor for smooth edges

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bgHits = 0;
      const fgHits = new Map();

      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = (px + (sx + 0.5) / ss) / size;
          const y = (py + (sy + 0.5) / ss) / size;
          if (!insideRoundedRect(x, y, tile)) continue;
          bgHits++;
          for (const shape of shapes) {
            if (insideRoundedRect(x, y, shape.rect)) {
              const key = shape.color.join(',');
              fgHits.set(key, (fgHits.get(key) ?? 0) + 1);
              break;
            }
          }
        }
      }

      const total = ss * ss;
      const alpha = Math.round((bgHits / total) * 255);
      let [r, g, b] = BG;
      for (const [key, hits] of fgHits) {
        const color = key.split(',').map(Number);
        const t = hits / total;
        r = Math.round(r * (1 - t) + color[0] * t);
        g = Math.round(g * (1 - t) + color[1] * t);
        b = Math.round(b * (1 - t) + color[2] * t);
      }

      const i = (py * size + px) * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = alpha;
    }
  }
  return encodePng(size, size, rgba);
}

mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable-512.png', 512, { maskable: true }],
  // iOS ignores transparency and squares the icon itself, so a full-bleed
  // variant looks correct on the home screen.
  ['apple-touch-icon-180.png', 180, { maskable: true }],
];

for (const [name, size, opts] of targets) {
  writeFileSync(join(OUT_DIR, name), renderIcon(size, opts));
  console.log(`wrote icons/${name} (${size}x${size})`);
}
