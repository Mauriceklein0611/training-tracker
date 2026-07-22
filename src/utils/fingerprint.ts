/**
 * Deterministic, dependency-free content fingerprints.
 *
 * Used to tie an AI response back to the export it was generated from and to
 * detect duplicate imports. This is a content hash for change detection, not a
 * cryptographic primitive.
 */

/** JSON with object keys sorted recursively, so equal data hashes equally. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

function fnv1a(text: string, seed: number): number {
  let hash = seed;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** A 16-hex-character fingerprint of any JSON-serialisable value. */
export function fingerprint(value: unknown): string {
  const json = stableStringify(value);
  const a = fnv1a(json, 0x811c9dc5);
  const b = fnv1a(json, 0x811c9dc5 ^ 0x9e3779b9);
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}
