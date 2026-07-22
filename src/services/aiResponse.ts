import { z } from 'zod';
import type { AiObservation, StoredAiProposal } from '@/types';
import { fingerprint } from '@/utils/fingerprint';

/**
 * Import side of the AI round-trip.
 *
 * Everything here is deliberately defensive: a response file is untrusted input.
 * It is parsed with a strict Zod schema (no free-text interpretation), only
 * known operations are accepted, values must be in range, and every target id is
 * checked against the current plans. `expected` values are compared with the
 * live plan so stale proposals surface as conflicts instead of silently
 * changing something the AI never saw.
 *
 * The core validation is pure — the current plans are injected as a context —
 * so it can be tested exhaustively without a database.
 */

/** The one response schema version this app understands. */
export const SUPPORTED_RESPONSE_SCHEMA_VERSION = 1;

const setsSchema = z.number().int().min(1).max(50);
const repSchema = z.number().int().min(0).max(1000);
const restSchema = z.number().int().min(0).max(3600);
const descriptionSchema = z.string().max(2000);

// `expected` values may be null to mean "this field was not set" in the plan.
const nullable = <T extends z.ZodTypeAny>(schema: T) => z.union([schema, z.null()]);

const targetChangeFields = {
  sets: setsSchema,
  repMin: repSchema,
  repMax: repSchema,
  restSeconds: restSchema,
};

const targetExpectedFields = {
  sets: nullable(setsSchema),
  repMin: nullable(repSchema),
  repMax: nullable(repSchema),
  restSeconds: nullable(restSchema),
};

// `.strict()` everywhere so an unknown field is rejected, never silently dropped.
const updateTargetProposal = z
  .object({
    proposalId: z.string().min(1),
    operation: z.literal('update_template_exercise_target'),
    target: z
      .object({ templateId: z.string().min(1), templateExerciseId: z.string().min(1) })
      .strict(),
    expected: z.object(targetExpectedFields).partial().strict().optional(),
    changes: z
      .object(targetChangeFields)
      .partial()
      .strict()
      .refine((value) => Object.keys(value).length > 0, {
        message: 'Vorschlag ohne Änderung',
      }),
    reason: z.string().max(2000).default(''),
  })
  .strict();

const updateNoteProposal = z
  .object({
    proposalId: z.string().min(1),
    operation: z.literal('update_template_note'),
    target: z.object({ templateId: z.string().min(1) }).strict(),
    expected: z
      .object({ description: nullable(descriptionSchema) })
      .partial()
      .strict()
      .optional(),
    changes: z.object({ description: descriptionSchema }).strict(),
    reason: z.string().max(2000).default(''),
  })
  .strict();

const proposalSchema = z.discriminatedUnion('operation', [
  updateTargetProposal,
  updateNoteProposal,
]);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const aiResponseSchema = z
  .object({
    format: z.literal('training-ai-response'),
    // Must match exactly — a newer/older version is rejected, not coerced.
    schemaVersion: z.literal(SUPPORTED_RESPONSE_SCHEMA_VERSION),
    sourceExport: z
      .object({ exportId: z.string().optional(), fingerprint: z.string().optional() })
      .strict()
      .optional(),
    feedback: z
      .object({
        headline: z.string().max(200).optional(),
        summary: z.string().max(5000).default(''),
        strengths: z.array(z.string().max(1000)).max(50).default([]),
        observations: z
          .array(
            z
              .object({
                title: z.string().max(300).default(''),
                text: z.string().max(3000).default(''),
              })
              .strict(),
          )
          .max(50)
          .default([]),
        recommendations: z.array(z.string().max(1000)).max(50).default([]),
        nextAnalysisAfter: isoDate.optional(),
      })
      .strict(),
    proposals: z.array(proposalSchema).max(100).default([]),
  })
  .strict()
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    data.proposals.forEach((proposal, index) => {
      // Duplicate proposal ids are rejected outright.
      if (seen.has(proposal.proposalId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Doppelte proposalId: ${proposal.proposalId}`,
          path: ['proposals', index, 'proposalId'],
        });
      }
      seen.add(proposal.proposalId);

      // Every changed field must state its previous value in `expected`.
      const expectedKeys = new Set(Object.keys(proposal.expected ?? {}));
      for (const key of Object.keys(proposal.changes)) {
        if (!expectedKeys.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `expected fehlt für Feld „${key}"`,
            path: ['proposals', index, 'expected'],
          });
        }
      }
    });
  });

export type AiResponse = z.infer<typeof aiResponseSchema>;

export type ParseResult =
  { ok: true; data: AiResponse } | { ok: false; errors: string[] };

/** Strictly parses a response string. Never interprets free text. */
export function parseAiResponse(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['Die Datei ist kein gültiges JSON.'] };
  }
  const parsed = aiResponseSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = parsed.error.issues.slice(0, 10).map((issue) => {
      const path = issue.path.join('.') || 'Datei';
      return `${path}: ${issue.message}`;
    });
    return { ok: false, errors };
  }
  return { ok: true, data: parsed.data };
}

export interface PlanContextExercise {
  name: string;
  targetSets: number;
  targetRepMin?: number;
  targetRepMax?: number;
  restSeconds: number;
}

export interface PlanContextTemplate {
  name: string;
  description: string;
  exercises: Map<string, PlanContextExercise>;
}

export interface PlanContext {
  templates: Map<string, PlanContextTemplate>;
  currentFingerprint: string;
  /** Known exportId → fingerprint at export time. */
  exports: Map<string, string>;
  seenImportFingerprints: Set<string>;
}

export type ProvenanceStatus = 'valid' | 'missing' | 'unknown' | 'fingerprint-mismatch';

export interface ValidatedAiImport {
  exportId?: string;
  importFingerprint: string;
  duplicate: boolean;
  exportKnown: boolean;
  provenance: ProvenanceStatus;
  planChangedSinceExport: boolean;
  /** True when the proposals may be selected and applied at all. */
  proposalsApplicable: boolean;
  feedback: {
    headline?: string;
    summary: string;
    strengths: string[];
    observations: AiObservation[];
    recommendations: string[];
    nextAnalysisAfter?: string;
  };
  proposals: StoredAiProposal[];
  warnings: string[];
}

const FIELD_TO_CURRENT: Record<string, keyof PlanContextExercise> = {
  sets: 'targetSets',
  repMin: 'targetRepMin',
  repMax: 'targetRepMax',
  restSeconds: 'restSeconds',
};

function checkTargetProposal(
  proposal: Extract<
    AiResponse['proposals'][number],
    { operation: 'update_template_exercise_target' }
  >,
  context: PlanContext,
): StoredAiProposal {
  const base: StoredAiProposal = { ...proposal, status: 'pending' };
  const template = context.templates.get(proposal.target.templateId);
  if (!template) {
    return { ...base, status: 'invalid', issue: 'Der Zielplan existiert nicht.' };
  }
  base.templateName = template.name;
  const exercise = template.exercises.get(proposal.target.templateExerciseId);
  if (!exercise) {
    return {
      ...base,
      status: 'invalid',
      issue: 'Die Zielübung existiert nicht in diesem Plan.',
    };
  }
  base.exerciseName = exercise.name;

  // repMin/repMax sanity: min must not exceed max after applying the change.
  const nextMin = proposal.changes.repMin ?? exercise.targetRepMin;
  const nextMax = proposal.changes.repMax ?? exercise.targetRepMax;
  if (nextMin != null && nextMax != null && nextMin > nextMax) {
    return { ...base, status: 'invalid', issue: 'Wiederholungsbereich min > max.' };
  }

  // Stale check: every expected value must match the live plan. A null in
  // `expected` means the field was unset, which matches a missing current value.
  if (proposal.expected) {
    for (const [field, value] of Object.entries(proposal.expected)) {
      const currentKey = FIELD_TO_CURRENT[field];
      const current = exercise[currentKey];
      const matches = value === null ? current == null : current === value;
      if (!matches) {
        return {
          ...base,
          status: 'conflict',
          issue: `Erwartet ${field}=${value ?? 'nicht gesetzt'}, aktuell ${current ?? 'nicht gesetzt'}. Der Plan wurde seit dem Export geändert.`,
        };
      }
    }
  }
  return base;
}

function checkNoteProposal(
  proposal: Extract<
    AiResponse['proposals'][number],
    { operation: 'update_template_note' }
  >,
  context: PlanContext,
): StoredAiProposal {
  const base: StoredAiProposal = { ...proposal, status: 'pending' };
  const template = context.templates.get(proposal.target.templateId);
  if (!template) {
    return { ...base, status: 'invalid', issue: 'Der Zielplan existiert nicht.' };
  }
  base.templateName = template.name;
  if (proposal.expected && 'description' in proposal.expected) {
    const expected = proposal.expected.description;
    const matches =
      expected === null ? !template.description : expected === template.description;
    if (!matches) {
      return {
        ...base,
        status: 'conflict',
        issue: 'Die aktuelle Beschreibung weicht von der erwarteten ab.',
      };
    }
  }
  return base;
}

/**
 * Validates a parsed response against the current plans, classifying each
 * proposal as pending / conflict / invalid. Pure: all live state comes from
 * `context`.
 */
/** Resolves the plan/exercise names of a proposal, for display. */
function resolveNames(
  proposal: AiResponse['proposals'][number],
  context: PlanContext,
): { templateName?: string; exerciseName?: string } {
  const template = context.templates.get(proposal.target.templateId);
  if (!template) return {};
  if (proposal.operation === 'update_template_exercise_target') {
    return {
      templateName: template.name,
      exerciseName: template.exercises.get(proposal.target.templateExerciseId)?.name,
    };
  }
  return { templateName: template.name };
}

export function validateAiResponse(
  response: AiResponse,
  context: PlanContext,
): ValidatedAiImport {
  const importFingerprint = fingerprint(response);
  const warnings: string[] = [];

  const exportId = response.sourceExport?.exportId;
  const responseFingerprint = response.sourceExport?.fingerprint;
  const storedFingerprint = exportId ? context.exports.get(exportId) : undefined;
  const exportKnown = exportId != null && context.exports.has(exportId);
  const duplicate = context.seenImportFingerprints.has(importFingerprint);

  // Four distinct provenance outcomes, each treated differently below.
  let provenance: ProvenanceStatus;
  if (!exportId || !responseFingerprint) provenance = 'missing';
  else if (!exportKnown) provenance = 'unknown';
  else if (storedFingerprint !== responseFingerprint) provenance = 'fingerprint-mismatch';
  else provenance = 'valid';

  // Only a valid provenance (and a non-duplicate import) lets proposals be
  // applied. Feedback is always shown and saved regardless.
  const blockReason = duplicate
    ? 'Diese Antwortdatei wurde bereits importiert — Planänderungen werden nicht erneut angewendet.'
    : provenance === 'missing'
      ? 'Ohne gültige Exportreferenz können keine Planänderungen übernommen werden.'
      : provenance === 'unknown'
        ? 'Der referenzierte Export ist unbekannt — Planänderungen sind gesperrt.'
        : provenance === 'fingerprint-mismatch'
          ? 'Die Exportreferenz passt nicht zum gespeicherten Export — Planänderungen sind gesperrt.'
          : null;

  if (blockReason && response.proposals.length > 0) warnings.push(blockReason);

  const planChangedSinceExport =
    provenance === 'valid' && storedFingerprint !== context.currentFingerprint;
  if (planChangedSinceExport) {
    warnings.push(
      'Deine Pläne haben sich seit diesem Export geändert. Vorschläge mit abweichenden Ausgangswerten werden als Konflikt markiert.',
    );
  }

  const proposals: StoredAiProposal[] = response.proposals.map((proposal) => {
    if (blockReason) {
      return {
        ...proposal,
        status: 'invalid',
        issue: blockReason,
        ...resolveNames(proposal, context),
      };
    }
    return proposal.operation === 'update_template_exercise_target'
      ? checkTargetProposal(proposal, context)
      : checkNoteProposal(proposal, context);
  });

  return {
    exportId,
    importFingerprint,
    duplicate,
    exportKnown,
    provenance,
    planChangedSinceExport,
    proposalsApplicable: blockReason == null,
    feedback: response.feedback,
    proposals,
    warnings,
  };
}
