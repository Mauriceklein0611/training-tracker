/**
 * UUID generation with a fallback for browsers/contexts where
 * `crypto.randomUUID` is unavailable (older iOS Safari, non-secure origins).
 */
export function uuid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();

  if (c && typeof c.getRandomValues === 'function') {
    const bytes = c.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Last resort — still collision-safe enough for a single-device app.
  const rnd = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
  return `${rnd()}${rnd()}-${rnd()}-4${rnd().slice(1)}-a${rnd().slice(1)}-${rnd()}${rnd()}${rnd()}`;
}

/** Returns the current time as an ISO-8601 string. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** True if the value looks like a UUID (used when validating imports). */
export function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
