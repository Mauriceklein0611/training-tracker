/**
 * Central registry of the portable file formats this app reads or writes.
 *
 * Every importable/exportable JSON file carries its format name and version in
 * its *content* (not just the file name). Keeping the names and version numbers
 * here — rather than as magic strings scattered across the codebase — is what
 * lets a single change stay consistent across schema, parser, exporter, preview
 * and tests. See docs/FORMAT_COMPATIBILITY.md for the full register and rules.
 *
 * Existing formats keep their established constants in their own modules for
 * backwards compatibility and are only referenced here:
 *   - Backup:            BACKUP_FORMAT_VERSION   (src/services/backup.ts)
 *   - AI analysis export: AI_EXPORT_VERSION      (src/services/aiExport.ts)
 *   - AI response import:  SUPPORTED_RESPONSE_SCHEMA_VERSION (src/services/aiResponse.ts)
 */

/** Portable training-plan package: AI-created plans, plan export and sharing. */
export const PLAN_PACKAGE_FORMAT = 'training-plan-package';
/** Current version: 2 adds multi-day plans (splits). Exports always write this. */
export const PLAN_PACKAGE_SCHEMA_VERSION = 2;
/**
 * Package versions this app can still import. Version 1 (single implicit day)
 * is converted on import into a plan with one day ("Tag A").
 */
export const SUPPORTED_PLAN_PACKAGE_VERSIONS = [1, 2] as const;

/** Self-describing kit handed to ChatGPT so it can build a plan package. */
export const PLAN_BUILDER_KIT_FORMAT = 'training-plan-builder-kit';
export const PLAN_BUILDER_KIT_VERSION = 2;
