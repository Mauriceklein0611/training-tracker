/**
 * Duration entry helpers.
 *
 * Durations are *stored* as whole seconds everywhere (`WorkoutSet.durationSeconds`,
 * the plan/unit duration targets, the rest targets) and every export keeps that
 * unchanged. Only the *entry* is split into hours/minutes/seconds, because a
 * one-hour run is entered as 1:20:30, not as 4830 seconds.
 *
 * Pure and language-independent: nothing here formats for display or touches a
 * stored value.
 */

export interface DurationParts {
  hours: number;
  minutes: number;
  seconds: number;
}

/** Splits whole seconds into hours/minutes/seconds. Negative input clamps to 0. */
export function splitDuration(totalSeconds: number): DurationParts {
  const total = Math.max(0, Math.round(totalSeconds));
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/**
 * Combines entered parts into whole seconds. Parts are *not* capped at 59: a
 * typed "90" in the minutes box is a legitimate 90 minutes and simply carries
 * over when the value is split again.
 */
export function combineDuration(parts: Partial<DurationParts>): number {
  const hours = Math.max(0, Math.round(parts.hours ?? 0));
  const minutes = Math.max(0, Math.round(parts.minutes ?? 0));
  const seconds = Math.max(0, Math.round(parts.seconds ?? 0));
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Parses a clock-style duration: "1:20:30" (h:mm:ss) or "20:30" (mm:ss).
 *
 * Returns `null` for anything that is not a clock string — including a plain
 * number, which is deliberately *not* interpreted here because "45" is
 * ambiguous (seconds or minutes?). The segmented entry field asks for each unit
 * separately instead; this parser only exists so a pasted or hand-typed
 * "1:20:30" is understood as well.
 */
export function parseClockDuration(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed.includes(':')) return null;
  const segments = trimmed.split(':');
  if (segments.length < 2 || segments.length > 3) return null;
  const numbers: number[] = [];
  for (const segment of segments) {
    const cleaned = segment.trim();
    if (!/^\d+$/.test(cleaned)) return null;
    numbers.push(Number(cleaned));
  }
  const [hours, minutes, seconds] =
    numbers.length === 3 ? numbers : [0, numbers[0], numbers[1]];
  return combineDuration({ hours, minutes, seconds });
}
