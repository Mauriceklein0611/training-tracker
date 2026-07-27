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
import {
  activateTemplateVersionWithinTransaction,
  createTemplateVersionWithinTransaction,
} from '@/db/repositories/templateVersions';
import {
  knownImportFingerprints,
  listAiExportRecords,
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
  { ok: true; value: ValidatedAiImport } | { ok: false; errors: string[] };

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
  // Test-only hook to force a failure inside the transaction and prove rollback.
  hooks: { beforeSave?: () => void | Promise<void> } = {},
): Promise<AiAnalysis> {
  const selected = new Set(selectedProposalIds);
  // Proposals are only ever applied when the provenance allowed it at all.
  const candidateIds = new Set(
    validated.proposalsApplicable
      ? validated.proposals
          .filter(
            (proposal) =>
              proposal.status === 'pending' && selected.has(proposal.proposalId),
          )
          .map((proposal) => proposal.proposalId)
      : [],
  );

  const finalProposals: StoredAiProposal[] = validated.proposals.map((proposal) => ({
    ...proposal,
  }));
  const byId = new Map(finalProposals.map((proposal) => [proposal.proposalId, proposal]));

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
    restoreVersionIds: [],
  };

  // Everything — re-validation, restore versions, plan edits and saving the
  // analysis — happens in one transaction. If anything throws, Dexie rolls the
  // whole thing back: no orphan version, no change without a saved analysis.
  await db.transaction(
    'rw',
    db.workoutTemplates,
    db.templateExercises,
    db.exercises,
    db.templateVersions,
    db.aiAnalyses,
    async () => {
      // Pass 1: re-validate each candidate against the *current* plan, so a
      // change since import is caught here too. Collect the ones that will apply.
      const toApply: StoredAiProposal[] = [];
      for (const id of candidateIds) {
        const proposal = byId.get(id);
        if (!proposal) continue;
        const verdict = await revalidate(proposal);
        if (verdict.ok) toApply.push(proposal);
        else Object.assign(proposal, verdict.change);
      }

      // Pass 2: one restore version per plan that actually gets a change. Their
      // ids are recorded on the analysis so the import can be undone one-click.
      const affectedTemplateIds = [...new Set(toApply.map((p) => p.target.templateId))];
      for (const templateId of affectedTemplateIds) {
        const version = await createTemplateVersionWithinTransaction(templateId, {
          source: 'ai-import',
          label: `Vor KI-Import ${now.toISOString().slice(0, 10)}`,
        });
        analysis.restoreVersionIds?.push(version.id);
      }

      // Pass 3: apply.
      for (const proposal of toApply) {
        await applyProposal(proposal);
        proposal.status = 'applied';
      }

      // Anything pending but not applied is recorded as skipped.
      for (const proposal of finalProposals) {
        if (proposal.status === 'pending') proposal.status = 'skipped';
      }

      await hooks.beforeSave?.();
      await db.aiAnalyses.add(analysis);
    },
  );

  return analysis;
}

export type UndoResult =
  | { ok: true; restoredPlans: number }
  | { ok: false; reason: 'not-found' | 'nothing-to-undo' | 'already-undone' };

/**
 * Reverts a stored AI import by reactivating the restore points it froze before
 * applying — the one-point undo. Each affected plan is set back to its
 * pre-import snapshot (which also discards any manual edits made since, hence
 * the UI confirmation). A restore point whose plan was deleted meanwhile is
 * skipped, never dangling. Marks the analysis as undone so it is offered once.
 *
 * Everything runs in one transaction: either every reachable plan is reverted
 * and the analysis is marked, or nothing changes.
 */
export async function undoAiAnalysis(
  analysisId: string,
  now: Date = new Date(),
): Promise<UndoResult> {
  return db.transaction(
    'rw',
    db.workoutTemplates,
    db.templateExercises,
    db.exercises,
    db.templateVersions,
    db.aiAnalyses,
    async (): Promise<UndoResult> => {
      const analysis = await db.aiAnalyses.get(analysisId);
      if (!analysis) return { ok: false, reason: 'not-found' };
      if (analysis.undoneAt) return { ok: false, reason: 'already-undone' };
      const versionIds = analysis.restoreVersionIds ?? [];
      if (versionIds.length === 0) return { ok: false, reason: 'nothing-to-undo' };

      let restoredPlans = 0;
      for (const versionId of versionIds) {
        const version = await db.templateVersions.get(versionId);
        if (!version) continue; // restore point gone (e.g. plan deleted)
        const template = await db.workoutTemplates.get(version.templateId);
        if (!template) continue; // plan deleted since the import
        await activateTemplateVersionWithinTransaction(versionId);
        restoredPlans += 1;
      }

      await db.aiAnalyses.update(analysisId, { undoneAt: now.toISOString() });
      return { ok: true, restoredPlans };
    },
  );
}

type Verdict =
  { ok: true } | { ok: false; change: Pick<StoredAiProposal, 'status' | 'issue'> };

/** Re-checks a proposal against the live plan inside the commit transaction. */
async function revalidate(proposal: StoredAiProposal): Promise<Verdict> {
  if (proposal.operation === 'update_template_exercise_target') {
    const exercise = await db.templateExercises.get(
      proposal.target.templateExerciseId ?? '',
    );
    if (!exercise || exercise.templateId !== proposal.target.templateId) {
      return {
        ok: false,
        change: { status: 'invalid', issue: 'Die Zielübung existiert nicht mehr.' },
      };
    }
    for (const [field, value] of Object.entries(proposal.expected ?? {})) {
      const column = FIELD_TO_COLUMN[field as keyof typeof FIELD_TO_COLUMN];
      const current = exercise[column];
      const matches = value === null ? current == null : current === value;
      if (!matches) {
        return {
          ok: false,
          change: { status: 'conflict', issue: 'Der Plan wurde inzwischen geändert.' },
        };
      }
    }
    return { ok: true };
  }

  const template = await db.workoutTemplates.get(proposal.target.templateId);
  if (!template) {
    return {
      ok: false,
      change: { status: 'invalid', issue: 'Der Zielplan existiert nicht mehr.' },
    };
  }
  const expected = proposal.expected?.description;
  if (expected !== undefined) {
    const matches =
      expected === null ? !template.description : expected === template.description;
    if (!matches) {
      return {
        ok: false,
        change: {
          status: 'conflict',
          issue: 'Die Beschreibung wurde inzwischen geändert.',
        },
      };
    }
  }
  return { ok: true };
}

/** Writes a re-validated proposal's change. Runs inside the commit transaction. */
async function applyProposal(proposal: StoredAiProposal): Promise<void> {
  if (proposal.operation === 'update_template_exercise_target') {
    const changes: Record<string, number> = {};
    for (const [field, value] of Object.entries(proposal.changes)) {
      changes[FIELD_TO_COLUMN[field as keyof typeof FIELD_TO_COLUMN]] = value as number;
    }
    await db.templateExercises.update(
      proposal.target.templateExerciseId as string,
      changes,
    );
    return;
  }
  await db.workoutTemplates.update(proposal.target.templateId, {
    description: String(proposal.changes.description),
    updatedAt: nowIso(),
  });
}
