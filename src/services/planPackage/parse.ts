import {
  PLAN_PACKAGE_FORMAT,
  SUPPORTED_PLAN_PACKAGE_VERSIONS,
} from '@/constants/formats';
import {
  planPackageSchema,
  planPackageSchemaV1,
  upgradeV1,
  type PlanPackage,
} from '@/services/planPackage/schema';
import type { ZodError } from 'zod';

/** Hard size cap so a pathological file cannot exhaust memory. */
export const MAX_PLAN_PACKAGE_BYTES = 512 * 1024;

export type ParsePlanPackageResult =
  | { ok: true; data: PlanPackage; migratedFromVersion?: number }
  | { ok: false; errors: string[] };

function collectIssues(error: ZodError): string[] {
  const errors = error.issues.slice(0, 12).map((issue) => {
    const path = issue.path.join('.') || 'Datei';
    return `${path}: ${issue.message}`;
  });
  if (error.issues.length > 12) {
    errors.push(`… und ${error.issues.length - 12} weitere Probleme.`);
  }
  return errors;
}

/**
 * Parses and strictly validates a plan-package file. Untrusted input: JSON is
 * parsed, the size and format are checked, a newer unsupported version is
 * rejected with a clear message (rather than partially read), a version-1 file
 * is validated and upgraded to the current day-based shape, and everything else
 * goes through the strict version-2 schema (unknown fields rejected).
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

  const isPackage =
    raw != null &&
    typeof raw === 'object' &&
    (raw as { format?: unknown }).format === PLAN_PACKAGE_FORMAT;
  const version = isPackage
    ? (raw as { schemaVersion?: unknown }).schemaVersion
    : undefined;

  // Reject a newer, unsupported version explicitly instead of dropping fields.
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

  // Version 1: validate against the v1 schema and upgrade to the day-based shape.
  if (version === 1) {
    const parsed = planPackageSchemaV1.safeParse(raw);
    if (!parsed.success) return { ok: false, errors: collectIssues(parsed.error) };
    return { ok: true, data: upgradeV1(parsed.data), migratedFromVersion: 1 };
  }

  const parsed = planPackageSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: collectIssues(parsed.error) };
  return { ok: true, data: parsed.data };
}
