import { db } from '@/db/db';
import { buildPlansExport } from '@/services/aiExport';
import {
  parseAiResponse,
  validateAiResponse,
  type PlanContext,
  type PlanContextTemplate,
  type ValidatedAiImport,
} from '@/services/aiResponse';
import { listTemplatesWithExercises } from '@/db/repositories/templates';
import { createTemplateVersion } from '@/db/repositories/templateVersions';
import {
  knownImportFingerprints,
  listAiExportRecords,
  saveAiAnalysis,
} from '@/db/repositories/aiAnalyses';
import type { AiAnalysis, StoredAiProposal } from '@/types';
import { fingerprint } from '@/utils/fingerprint';
import { nowIso, uuid } from '@/utils/id';

/** Builds the validation context (current plans, known exports, seen imports). */
export async function buildPlanContext(): Promise<PlanContext> {
  const templates = await listTemplatesWithExercises();
  const plans = buildPlansExport(templates);

  const templateMap = new Map<string, PlanContextTemplate>();
  for (const template of templates) {
    const exercises = new Map(
      template.exercises.map((exercise) => [
        exercise.id,
        {
          name: exercise.exercise?.name ?? 'Gelöschte Übung',
          targetSets: exercise.targetSets,
          targetRepMin: exercise.targetRepMin,
          targetRepMax: exercise.targetRepMax,
          restSeconds: exercise.restSeconds,
        },
      ]),
    );
    templateMap.set(template.template.id, {
      name: template.template.name,
      description: template.template.description,
      exercises,
    });
  }

  const [exportRecords, seen] = await Promise.all([
    listAiExportRecords(),
    knownImportFingerprints(),
  ]);

  return {
    templates: templateMap,
    currentFingerprint: fingerprint(plans),
    exports: new Map(exportRecords.map((record) => [record.id, record.fingerprint])),
    seenImportFingerprints: seen,
  };
}

export type ImportResult =
  | { ok: true; value: ValidatedAiImport }
  | { ok: false; errors: string[] };

/** Parses and validates a response file; does not persist anything yet. */
export async function importAiResponse(text: string): Promise<ImportResult> {
  const parsed = parseAiResponse(text);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const context = await buildPlanContext();
  return { ok: true, value: validateAiResponse(parsed.data, context) };
}

const FIELD_TO_COLUMN = {
  sets: 'targetSets',
  repMin: 'targetRepMin',
  repMax: 'targetRepMax',
  restSeconds: 'restSeconds',
} as const;

/**
 * Applies the chosen proposals and stores the analysis.
 *
 * Each affected plan is first frozen as an `ai-import` version, so a change is
 * always reversible by reactivating that version. Proposals are re-checked
 * against the live plan at apply time (a second staleness guard), and only
 * pending, selected, still-valid ones are written — inside a single transaction.
 */
export async function commitAiAnalysis(
  validated: ValidatedAiImport,
  selectedProposalIds: string[],
  now: Date = new Date(),
): Promise<AiAnalysis> {
  const selected = new Set(selectedProposalIds);
  const toApply = validated.proposals.filter(
    (proposal) => proposal.status === 'pending' && selected.has(proposal.proposalId),
  );
  const affectedTemplateIds = [...new Set(toApply.map((proposal) => proposal.target.templateId))];

  // Freeze each affected plan before touching it.
  for (const templateId of affectedTemplateIds) {
    await createTemplateVersion(templateId, {
      source: 'ai-import',
      label: `Vor KI-Import ${now.toISOString().slice(0, 10)}`,
    });
  }

  const finalProposals: StoredAiProposal[] = validated.proposals.map((proposal) => ({ ...proposal }));
  const byId = new Map(finalProposals.map((proposal) => [proposal.proposalId, proposal]));

  await db.transaction(
    'rw',
    db.workoutTemplates,
    db.templateExercises,
    async () => {
      for (const proposal of toApply) {
        const stored = byId.get(proposal.proposalId);
        if (!stored) continue;

        if (proposal.operation === 'update_template_exercise_target') {
          const exercise = await db.templateExercises.get(proposal.target.templateExerciseId ?? '');
          if (!exercise || exercise.templateId !== proposal.target.templateId) {
            stored.status = 'invalid';
            stored.issue = 'Die Zielübung existiert nicht mehr.';
            continue;
          }
          // Re-check expected against the live values right now.
          const drift = Object.entries(proposal.expected ?? {}).find(([field, value]) => {
            const column = FIELD_TO_COLUMN[field as keyof typeof FIELD_TO_COLUMN];
            return exercise[column] !== value;
          });
          if (drift) {
            stored.status = 'conflict';
            stored.issue = 'Der Plan wurde inzwischen geändert.';
            continue;
          }
          const changes: Record<string, number> = {};
          for (const [field, value] of Object.entries(proposal.changes)) {
            changes[FIELD_TO_COLUMN[field as keyof typeof FIELD_TO_COLUMN]] = value as number;
          }
          await db.templateExercises.update(exercise.id, changes);
          stored.status = 'applied';
        } else {
          const template = await db.workoutTemplates.get(proposal.target.templateId);
          if (!template) {
            stored.status = 'invalid';
            stored.issue = 'Der Zielplan existiert nicht mehr.';
            continue;
          }
          if (
            proposal.expected?.description != null &&
            proposal.expected.description !== template.description
          ) {
            stored.status = 'conflict';
            stored.issue = 'Die Beschreibung wurde inzwischen geändert.';
            continue;
          }
          await db.workoutTemplates.update(template.id, {
            description: String(proposal.changes.description),
            updatedAt: nowIso(),
          });
          stored.status = 'applied';
        }
      }
    },
  );

  // Everything that was pending but not chosen is recorded as skipped.
  for (const proposal of finalProposals) {
    if (proposal.status === 'pending') proposal.status = 'skipped';
  }

  const analysis: AiAnalysis = {
    id: uuid(),
    importedAt: now.toISOString(),
    exportId: validated.exportId,
    headline: validated.feedback.headline,
    summary: validated.feedback.summary,
    strengths: validated.feedback.strengths,
    observations: validated.feedback.observations,
    recommendations: validated.feedback.recommendations,
    nextAnalysisAfter: validated.feedback.nextAnalysisAfter,
    importFingerprint: validated.importFingerprint,
    proposals: finalProposals,
  };
  await saveAiAnalysis(analysis);
  return analysis;
}
