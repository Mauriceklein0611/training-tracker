import { todayKey } from '@/utils/date';

/**
 * Personal profile values (#46).
 *
 * Everything here is optional and purely descriptive: a name only personalises
 * the greeting, height and birth date put the training figures in context. The
 * *age* is deliberately never stored — it is derived from the birth date on
 * read, so it cannot quietly go stale in the database or in an old backup.
 */

export const MIN_HEIGHT_CM = 50;
export const MAX_HEIGHT_CM = 280;
export const MAX_DISPLAY_NAME_LENGTH = 60;
/** Oldest birth date accepted; anything earlier is a typo, not a person. */
export const EARLIEST_BIRTH_DATE = '1900-01-01';

/** Full years between a birth date and today, or null when unknown/implausible. */
export function ageFromBirthDate(
  birthDate: string | undefined,
  today: string = todayKey(),
): number | null {
  if (!birthDate || !isPlausibleBirthDate(birthDate, today)) return null;

  const [year, month, day] = birthDate.split('-').map(Number);
  const [nowYear, nowMonth, nowDay] = today.split('-').map(Number);
  let age = nowYear - year;
  // Not had this year's birthday yet.
  if (nowMonth < month || (nowMonth === month && nowDay < day)) age -= 1;
  return age >= 0 ? age : null;
}

/** A real calendar date between 1900 and today. */
export function isPlausibleBirthDate(value: string, today: string = todayKey()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  // Rejects 2026-02-31 and friends: the parsed date must round-trip.
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  if (parsed.toISOString().slice(0, 10) !== value) return false;
  return value >= EARLIEST_BIRTH_DATE && value <= today;
}

/** Height in centimetres, or null when the input is empty or implausible. */
export function normalizeHeightCm(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < MIN_HEIGHT_CM || rounded > MAX_HEIGHT_CM) return null;
  return rounded;
}

/**
 * The name used for the greeting: trimmed and length-capped, or undefined when
 * nothing usable is left. Never invents a name from other data.
 */
export function normalizeDisplayName(value: string): string | undefined {
  const trimmed = value.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Body mass index from height and weight, or null when either is missing. */
export function bodyMassIndex(
  heightCm: number | undefined,
  weightKg: number | null | undefined,
): number | null {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null;
  const metres = heightCm / 100;
  return weightKg / (metres * metres);
}
