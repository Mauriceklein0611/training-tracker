import { describe, expect, it } from 'vitest';
import { fingerprint, stableStringify } from '@/utils/fingerprint';

describe('stableStringify', () => {
  it('is independent of key order', () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
  });

  it('drops undefined values', () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe(stableStringify({ a: 1 }));
  });
});

describe('fingerprint', () => {
  it('is deterministic and order-independent', () => {
    expect(fingerprint({ a: 1, b: [2, 3] })).toBe(fingerprint({ b: [2, 3], a: 1 }));
  });

  it('changes when the content changes', () => {
    expect(fingerprint({ sets: 3 })).not.toBe(fingerprint({ sets: 4 }));
  });

  it('produces a 16-character hex string', () => {
    expect(fingerprint({ any: 'value' })).toMatch(/^[0-9a-f]{16}$/);
  });
});
