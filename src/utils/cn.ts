/** Joins conditional class names. Deliberately tiny — no extra dependency. */
export function cn(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}
