import {
  PLAN_PACKAGE_FORMAT,
  SUPPORTED_PLAN_PACKAGE_VERSIONS,
} from '@/constants/formats';
import { planPackageSchema, type PlanPackage } from '@/services/planPackage/schema';

/** Hard size cap so a pathological file cannot exhaust memory. */
export const MAX_PLAN_PACKAGE_BYTES = 512 * 1024;

export type ParsePlanPackageResult =
  { ok: true; data: PlanPackage } | { ok: false; errors: string[] };

/**
 * Parses and strictly validates a plan-package file. Untrusted input: JSON is
 * parsed, the size and format are checked, a newer unsupported version is
 * rejected with a clear message (rather than partially read), and everything
 * else goes through the strict Zod schema (unknown fields rejected).
 */
export function parsePlanPackage(text: string): ParsePlanPackageResult {
  if (text.length > MAX_PLAN_PACKAGE_BYTES) {
    return {
      ok: false,
      errors: ['Die Datei ist zu groß, um sicher verarbeitet zu werden.'],
    };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['Die Datei ist keine gültige JSON-Datei.'] };
  }

  // Reject a newer, unsupported version explicitly instead of dropping fields.
  if (
    raw &&
    typeof raw === 'object' &&
    (raw as { format?: unknown }).format === PLAN_PACKAGE_FORMAT
  ) {
    const version = (raw as { schemaVersion?: unknown }).schemaVersion;
    if (
      typeof version === 'number' &&
      !SUPPORTED_PLAN_PACKAGE_VERSIONS.includes(
        version as (typeof SUPPORTED_PLAN_PACKAGE_VERSIONS)[number],
      )
    ) {
      return {
        ok: false,
        errors: [
          `Diese Datei verwendet eine neuere, nicht unterstützte Paketversion (${version}). ` +
            'Bitte aktualisiere zuerst die App.',
        ],
      };
    }
  }

  const parsed = planPackageSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = parsed.error.issues.slice(0, 12).map((issue) => {
      const path = issue.path.join('.') || 'Datei';
      return `${path}: ${issue.message}`;
    });
    if (parsed.error.issues.length > 12) {
      errors.push(`… und ${parsed.error.issues.length - 12} weitere Probleme.`);
    }
    return { ok: false, errors };
  }

  return { ok: true, data: parsed.data };
}
