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

const setsSchema = z.number().int().min(1).max(50);
const repSchema = z.number().int().min(0).max(1000);
const restSchema = z.number().int().min(0).max(3600);
const descriptionSchema = z.string().max(2000);

const targetChangeFields = {
  sets: setsSchema,
  repMin: repSchema,
  repMax: repSchema,
  restSeconds: restSchema,
};

const updateTargetProposal = z.object({
  proposalId: z.string().min(1),
  operation: z.literal('update_template_exercise_target'),
  target: z.object({
    templateId: z.string().min(1),
    templateExerciseId: z.string().min(1),
  }),
  expected: z.object(targetChangeFields).partial().optional(),
  changes: z
    .object(targetChangeFields)
    .partial()
    .refine((value) => Object.keys(value).length > 0, {
      message: 'Vorschlag ohne Änderung',
    }),
  reason: z.string().max(2000).default(''),
});

const updateNoteProposal = z.object({
  proposalId: z.string().min(1),
  operation: z.literal('update_template_note'),
  target: z.object({ templateId: z.string().min(1) }),
  expected: z.object({ description: descriptionSchema }).partial().optional(),
  changes: z.object({ description: descriptionSchema }),
  reason: z.string().max(2000).default(''),
});

const proposalSchema = z.discriminatedUnion('operation', [
  updateTargetProposal,
  updateNoteProposal,
]);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const aiResponseSchema = z.object({
  format: z.literal('training-ai-response'),
  schemaVersion: z.number().int().min(1),
  sourceExport: z
    .object({ exportId: z.string().optional(), fingerprint: z.string().optional() })
    .optional(),
  feedback: z.object({
    headline: z.string().max(200).optional(),
    summary: z.string().max(5000).default(''),
    strengths: z.array(z.string().max(1000)).max(50).default([]),
    observations: z
      .array(z.object({ title: z.string().max(300).default(''), text: z.string().max(3000).default('') }))
      .max(50)
      .default([]),
    recommendations: z.array(z.string().max(1000)).max(50).default([]),
    nextAnalysisAfter: isoDate.optional(),
  }),
  proposals: z.array(proposalSchema).max(100).default([]),
});

export type AiResponse = z.infer<typeof aiResponseSchema>;

export type ParseResult =
  | { ok: true; data: AiResponse }
  | { ok: false; errors: string[] };

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

export interface ValidatedAiImport {
  exportId?: string;
  importFingerprint: string;
  duplicate: boolean;
  exportKnown: boolean;
  planChangedSinceExport: boolean;
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
  proposal: Extract<AiResponse['proposals'][number], { operation: 'update_template_exercise_target' }>,
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
    return { ...base, status: 'invalid', issue: 'Die Zielübung existiert nicht in diesem Plan.' };
  }
  base.exerciseName = exercise.name;

  // repMin/repMax sanity: min must not exceed max after applying the change.
  const nextMin = proposal.changes.repMin ?? exercise.targetRepMin;
  const nextMax = proposal.changes.repMax ?? exercise.targetRepMax;
  if (nextMin != null && nextMax != null && nextMin > nextMax) {
    return { ...base, status: 'invalid', issue: 'Wiederholungsbereich min > max.' };
  }

  // Stale check: every expected value must match the live plan.
  if (proposal.expected) {
    for (const [field, value] of Object.entries(proposal.expected)) {
      const currentKey = FIELD_TO_CURRENT[field];
      const current = exercise[currentKey];
      if (current !== value) {
        return {
          ...base,
          status: 'conflict',
          issue: `Erwartet ${field}=${value}, aktuell ${current ?? '–'}. Der Plan wurde seit dem Export geändert.`,
        };
      }
    }
  }
  return base;
}

function checkNoteProposal(
  proposal: Extract<AiResponse['proposals'][number], { operation: 'update_template_note' }>,
  context: PlanContext,
): StoredAiProposal {
  const base: StoredAiProposal = { ...proposal, status: 'pending' };
  const template = context.templates.get(proposal.target.templateId);
  if (!template) {
    return { ...base, status: 'invalid', issue: 'Der Zielplan existiert nicht.' };
  }
  base.templateName = template.name;
  if (proposal.expected?.description != null && proposal.expected.description !== template.description) {
    return {
      ...base,
      status: 'conflict',
      issue: 'Die aktuelle Beschreibung weicht von der erwarteten ab.',
    };
  }
  return base;
}

/**
 * Validates a parsed response against the current plans, classifying each
 * proposal as pending / conflict / invalid. Pure: all live state comes from
 * `context`.
 */
export function validateAiResponse(
  response: AiResponse,
  context: PlanContext,
): ValidatedAiImport {
  const importFingerprint = fingerprint(response);
  const warnings: string[] = [];

  const exportId = response.sourceExport?.exportId;
  const exportKnown = exportId != null && context.exports.has(exportId);
  if (exportId && !exportKnown) {
    warnings.push(
      'Diese Antwort verweist auf einen unbekannten Export. Prüfe die Vorschläge besonders sorgfältig.',
    );
  }

  const exportFingerprint = exportId ? context.exports.get(exportId) : undefined;
  const planChangedSinceExport =
    exportFingerprint != null && exportFingerprint !== context.currentFingerprint;
  if (planChangedSinceExport) {
    warnings.push(
      'Deine Pläne haben sich seit diesem Export geändert. Einzelne Vorschläge können veraltet sein.',
    );
  }

  const proposals = response.proposals.map((proposal) =>
    proposal.operation === 'update_template_exercise_target'
      ? checkTargetProposal(proposal, context)
      : checkNoteProposal(proposal, context),
  );

  return {
    exportId,
    importFingerprint,
    duplicate: context.seenImportFingerprints.has(importFingerprint),
    exportKnown,
    planChangedSinceExport,
    feedback: response.feedback,
    proposals,
    warnings,
  };
}
