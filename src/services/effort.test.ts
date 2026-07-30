import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage } from '@/i18n';
import { approxRirFromRpe, approxRpeFromRir, formatEffort } from '@/services/effort';

afterEach(() => setLanguage('de'));

describe('effort RPE ↔ RIR approximation', () => {
  it('maps the canonical RPE values to RIR', () => {
    expect(approxRirFromRpe(10)).toBe(0);
    expect(approxRirFromRpe(9)).toBe(1);
    expect(approxRirFromRpe(8)).toBe(2);
    expect(approxRirFromRpe(7)).toBe(3);
    expect(approxRirFromRpe(6)).toBe(4);
  });

  it('maps RIR back to RPE', () => {
    expect(approxRpeFromRir(0)).toBe(10);
    expect(approxRpeFromRir(1)).toBe(9);
    expect(approxRpeFromRir(4)).toBe(6);
  });

  it('handles half steps and clamps out-of-range values', () => {
    expect(approxRirFromRpe(8.5)).toBe(1.5);
    // RPE cannot exceed 10, RIR cannot go below 0.
    expect(approxRirFromRpe(11)).toBe(0);
    // A very high RIR still yields a valid RPE ≥ 1.
    expect(approxRpeFromRir(20)).toBe(1);
  });

  it('formats effort values with the selected locale', () => {
    setLanguage('de');
    expect(formatEffort(8)).toBe('8');
    expect(formatEffort(8.5)).toBe('8,5');
    setLanguage('en');
    expect(formatEffort(8.5)).toBe('8.5');
  });
});
