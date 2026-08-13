import { describe, expect, it } from 'vitest';
import { combineDuration, parseClockDuration, splitDuration } from '@/services/duration';

describe('splitDuration', () => {
  it('splits whole seconds into hours, minutes and seconds', () => {
    expect(splitDuration(4830)).toEqual({ hours: 1, minutes: 20, seconds: 30 });
    expect(splitDuration(45)).toEqual({ hours: 0, minutes: 0, seconds: 45 });
    expect(splitDuration(3600)).toEqual({ hours: 1, minutes: 0, seconds: 0 });
  });

  it('clamps a negative duration to zero instead of inventing a sign', () => {
    expect(splitDuration(-10)).toEqual({ hours: 0, minutes: 0, seconds: 0 });
  });
});

describe('combineDuration', () => {
  it('adds the parts up', () => {
    expect(combineDuration({ hours: 1, minutes: 20, seconds: 30 })).toBe(4830);
  });

  it('treats missing parts as zero', () => {
    expect(combineDuration({ seconds: 45 })).toBe(45);
    expect(combineDuration({})).toBe(0);
  });

  it('does not cap minutes or seconds at 59 — 90 minutes are 90 minutes', () => {
    expect(combineDuration({ minutes: 90 })).toBe(5400);
    expect(combineDuration({ seconds: 90 })).toBe(90);
  });

  it('round-trips through splitDuration', () => {
    expect(combineDuration(splitDuration(4830))).toBe(4830);
    expect(splitDuration(combineDuration({ seconds: 90 }))).toEqual({
      hours: 0,
      minutes: 1,
      seconds: 30,
    });
  });
});

describe('parseClockDuration', () => {
  it('reads h:mm:ss', () => {
    expect(parseClockDuration('1:20:30')).toBe(4830);
    expect(parseClockDuration(' 0:00:45 ')).toBe(45);
  });

  it('reads mm:ss', () => {
    expect(parseClockDuration('20:30')).toBe(1230);
    expect(parseClockDuration('90:00')).toBe(5400);
  });

  it('returns null for a plain number, because it would be ambiguous', () => {
    expect(parseClockDuration('45')).toBeNull();
    expect(parseClockDuration('')).toBeNull();
  });

  it('rejects anything that is not a clock value', () => {
    expect(parseClockDuration('1:2:3:4')).toBeNull();
    expect(parseClockDuration('a:b')).toBeNull();
    expect(parseClockDuration('1:-5')).toBeNull();
    expect(parseClockDuration('1:2,5')).toBeNull();
  });
});
