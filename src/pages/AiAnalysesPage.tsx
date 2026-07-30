import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Check,
  ClipboardPaste,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge, Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { TextAreaField } from '@/components/ui/Field';
import {
  commitAiAnalysis,
  importAiResponse,
  undoAiAnalysis,
} from '@/db/repositories/aiApply';
import { deleteAiAnalysis, listAiAnalyses } from '@/db/repositories/aiAnalyses';
import { useToast } from '@/hooks/useToast';
import type { AiAnalysis, AiProposalStatus, StoredAiProposal } from '@/types';
import type { ValidatedAiImport } from '@/services/aiResponse';
import { readFileAsText } from '@/utils/download';
import { formatDateTime } from '@/utils/date';

const STATUS_KEY = {
  pending: 'aiAnalyses.status.pending',
  applied: 'aiAnalyses.status.applied',
  skipped: 'aiAnalyses.status.skipped',
  conflict: 'aiAnalyses.status.conflict',
  invalid: 'aiAnalyses.status.invalid',
} as const satisfies Record<AiProposalStatus, string>;

const FIELD_KEY = {
  sets: 'aiAnalyses.fields.sets',
  repMin: 'aiAnalyses.fields.repMin',
  repMax: 'aiAnalyses.fields.repMax',
  restSeconds: 'aiAnalyses.fields.restSeconds',
  durationSeconds: 'aiAnalyses.fields.durationSeconds',
  distanceMeters: 'aiAnalyses.fields.distanceMeters',
  rpe: 'aiAnalyses.fields.rpe',
  description: 'aiAnalyses.fields.description',
} as const;

const STATUS_TONE: Record<
  AiProposalStatus,
  'accent' | 'success' | 'default' | 'warning' | 'danger'
> = {
  pending: 'accent',
  applied: 'success',
  skipped: 'default',
  conflict: 'warning',
  invalid: 'danger',
};

function useLocalizedAiServiceMessage() {
  const { t } = useTranslation('data');

  return (message: string) => {
    switch (message) {
      case 'Der Zielplan existiert nicht.':
        return t('aiAnalyses.serviceMessage.targetPlanMissing');
      case 'Die Zielübung existiert nicht in diesem Plan.':
        return t('aiAnalyses.serviceMessage.targetExerciseMissing');
      case 'Wiederholungsbereich min > max.':
        return t('aiAnalyses.serviceMessage.invalidRepRange');
      case 'Die aktuelle Beschreibung weicht von der erwarteten ab.':
        return t('aiAnalyses.serviceMessage.descriptionMismatch');
      case 'Die Zielübung existiert nicht mehr.':
        return t('aiAnalyses.serviceMessage.targetExerciseGone');
      case 'Der Plan wurde inzwischen geändert.':
        return t('aiAnalyses.serviceMessage.planChanged');
      case 'Der Zielplan existiert nicht mehr.':
        return t('aiAnalyses.serviceMessage.targetPlanGone');
      case 'Die Beschreibung wurde inzwischen geändert.':
        return t('aiAnalyses.serviceMessage.descriptionChanged');
      case 'Diese Antwortdatei wurde bereits importiert — Planänderungen werden nicht erneut angewendet.':
        return t('aiAnalyses.serviceMessage.duplicateBlocked');
      case 'Ohne gültige Exportreferenz können keine Planänderungen übernommen werden.':
        return t('aiAnalyses.serviceMessage.referenceMissing');
      case 'Der referenzierte Export ist unbekannt — Planänderungen sind gesperrt.':
        return t('aiAnalyses.serviceMessage.referenceUnknown');
      case 'Die Exportreferenz passt nicht zum gespeicherten Export — Planänderungen sind gesperrt.':
        return t('aiAnalyses.serviceMessage.referenceMismatch');
      case 'Deine Pläne haben sich seit diesem Export geändert. Vorschläge mit abweichenden Ausgangswerten werden als Konflikt markiert.':
        return t('aiAnalyses.serviceMessage.plansChanged');
    }

    const changed = message.match(
      /^Erwartet ([^=]+)=([^,]+), aktuell ([^.]+)\. Der Plan wurde seit dem Export geändert\.$/,
    );
    if (changed) {
      const fieldKey = FIELD_KEY[changed[1] as keyof typeof FIELD_KEY];
      return t('aiAnalyses.serviceMessage.changedValue', {
        field: fieldKey ? t(fieldKey) : changed[1],
        expected:
          changed[2] === 'nicht gesetzt'
            ? t('aiAnalyses.serviceMessage.unset')
            : changed[2],
        current:
          changed[3] === 'nicht gesetzt'
            ? t('aiAnalyses.serviceMessage.unset')
            : changed[3],
      });
    }
    return t('aiAnalyses.serviceMessage.unknown');
  };
}

/** A single proposal card; selectable only while it is still pending. */
function ProposalCard({
  proposal,
  selectable,
  selected,
  onToggle,
}: {
  proposal: StoredAiProposal;
  selectable: boolean;
  selected: boolean;
  onToggle?: () => void;
}) {
  const { t } = useTranslation('data');
  const localizeServiceMessage = useLocalizedAiServiceMessage();
  const lines = Object.entries(proposal.changes).map(([field, to]) => {
    const fieldKey = FIELD_KEY[field as keyof typeof FIELD_KEY];
    return {
      label: fieldKey ? t(fieldKey) : field,
      from: proposal.expected?.[field] != null ? String(proposal.expected[field]) : '–',
      to: String(to),
    };
  });

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">
            {proposal.exerciseName ??
              proposal.templateName ??
              t('aiAnalyses.planFallback')}
          </p>
          {proposal.templateName && proposal.exerciseName ? (
            <p className="text-xs text-muted">{proposal.templateName}</p>
          ) : null}
        </div>
        <Badge tone={STATUS_TONE[proposal.status]}>
          {t(STATUS_KEY[proposal.status])}
        </Badge>
      </div>

      <dl className="mt-2 grid gap-1 text-sm">
        {lines.map((line) => (
          <div key={line.label} className="flex flex-wrap items-baseline gap-x-2">
            <dt className="text-muted">{line.label}:</dt>
            <dd className="numeric">
              <span className="text-muted line-through">{line.from}</span>
              {' → '}
              <span className="font-medium">{line.to}</span>
            </dd>
          </div>
        ))}
      </dl>

      {proposal.reason ? (
        <p className="mt-2 text-xs leading-relaxed text-muted">{proposal.reason}</p>
      ) : null}
      {proposal.issue ? (
        <p className="mt-1 text-xs font-medium text-warning">
          <span aria-hidden="true">⚠ </span>
          {localizeServiceMessage(proposal.issue)}
        </p>
      ) : null}

      {selectable && onToggle ? (
        <label className="mt-3 flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="h-6 w-6 accent-[var(--accent)]"
          />
          {t('aiAnalyses.apply')}
        </label>
      ) : null}
    </div>
  );
}

/** Plain-text feedback. Rendered as text nodes only — never as markup. */
function FeedbackView({ feedback }: { feedback: ValidatedAiImport['feedback'] }) {
  const { t } = useTranslation('data');

  return (
    <div className="grid gap-3">
      {feedback.headline ? <p className="font-semibold">{feedback.headline}</p> : null}
      {feedback.summary ? (
        <p className="text-sm leading-relaxed">{feedback.summary}</p>
      ) : null}

      {feedback.strengths.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t('aiAnalyses.feedback.strengths')}
          </h3>
          <ul className="mt-1 grid list-disc gap-1 pl-5 text-sm">
            {feedback.strengths.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {feedback.observations.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t('aiAnalyses.feedback.observations')}
          </h3>
          <ul className="mt-1 grid gap-2 text-sm">
            {feedback.observations.map((item, index) => (
              <li key={index}>
                {item.title ? <span className="font-medium">{item.title}: </span> : null}
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {feedback.recommendations.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t('aiAnalyses.feedback.recommendations')}
          </h3>
          <ul className="mt-1 grid list-disc gap-1 pl-5 text-sm">
            {feedback.recommendations.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {feedback.nextAnalysisAfter ? (
        <p className="text-xs text-muted">
          {t('aiAnalyses.feedback.next', { date: feedback.nextAnalysisAfter })}
        </p>
      ) : null}
    </div>
  );
}

export default function AiAnalysesPage() {
  const { t } = useTranslation('data');
  const { t: tCommon } = useTranslation('common');
  const localizeServiceMessage = useLocalizedAiServiceMessage();
  const toast = useToast();
  const analyses = useLiveQuery(() => listAiAnalyses(), [], []);
  const fileInput = useRef<HTMLInputElement>(null);

  const [paste, setPaste] = useState('');
  const [review, setReview] = useState<ValidatedAiImport | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState<AiAnalysis | null>(null);
  const [undo, setUndo] = useState<AiAnalysis | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Only the most recent import that froze restore points can be undone
  // (a strict one-point undo). Older imports may already have been superseded.
  const undoableId = analyses.find(
    (analysis) => (analysis.restoreVersionIds?.length ?? 0) > 0,
  )?.id;

  const startReview = async (text: string) => {
    const result = await importAiResponse(text);
    if (!result.ok) {
      const firstError = result.errors[0] ?? '';
      const detail =
        firstError === 'Die Datei ist kein gültiges JSON.'
          ? t('aiAnalyses.toast.invalidJson')
          : firstError.includes('Vorschlag ohne Änderung')
            ? t('aiAnalyses.toast.proposalWithoutChange')
            : firstError.includes('Doppelte proposalId')
              ? t('aiAnalyses.toast.duplicateProposal')
              : firstError.includes('expected fehlt für Feld')
                ? t('aiAnalyses.toast.expectedMissing')
                : t('aiAnalyses.toast.invalidResponse');
      toast.show(t('aiAnalyses.toast.rejected', { detail }), 'error');
      return;
    }
    setReview(result.value);
    setSelected(
      new Set(
        result.value.proposals
          .filter((proposal) => proposal.status === 'pending')
          .map((proposal) => proposal.proposalId),
      ),
    );
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      await startReview(await readFileAsText(file));
    } catch {
      toast.show(t('toast.fileReadFailed'), 'error');
    }
  };

  const handlePaste = async () => {
    if (!paste.trim()) return;
    await startReview(paste);
  };

  const handleCommit = async () => {
    if (!review) return;
    setBusy(true);
    try {
      const analysis = await commitAiAnalysis(review, [...selected]);
      const applied = analysis.proposals.filter((p) => p.status === 'applied').length;
      toast.show(
        applied > 0
          ? applied === 1
            ? t('aiAnalyses.toast.appliedOne')
            : t('aiAnalyses.toast.appliedOther', { value: applied })
          : t('aiAnalyses.toast.savedWithoutChanges'),
        'success',
      );
      setReview(null);
      setPaste('');
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  };

  const handleUndo = async (analysis: AiAnalysis) => {
    setUndo(null);
    const result = await undoAiAnalysis(analysis.id);
    if (result.ok) {
      toast.show(
        result.restoredPlans > 0
          ? result.restoredPlans === 1
            ? t('aiAnalyses.toast.undoRestoredOne')
            : t('aiAnalyses.toast.undoRestoredOther', {
                value: result.restoredPlans,
              })
          : t('aiAnalyses.toast.undoWithoutPlans'),
        'success',
      );
    } else {
      toast.show(t('aiAnalyses.toast.undoUnavailable'), 'error');
    }
  };

  const pendingCount =
    review?.proposals.filter((p) => p.status === 'pending').length ?? 0;

  return (
    <>
      <PageHeader
        title={t('aiAnalyses.title')}
        subtitle={t('aiAnalyses.subtitle')}
        backTo="/mehr"
      />

      {review ? (
        <Card className="mb-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">{t('aiAnalyses.review.title')}</h2>
            <Button variant="ghost" size="sm" onClick={() => setReview(null)}>
              <X size={16} aria-hidden="true" />
              {t('aiAnalyses.review.discard')}
            </Button>
          </div>

          {review.duplicate ? (
            <p className="mb-3 flex items-start gap-2 rounded-xl bg-surface-2 p-2 text-sm text-warning">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              {t('aiAnalyses.review.duplicate')}
            </p>
          ) : null}
          {review.warnings.map((warning) => (
            <p
              key={warning}
              className="mb-2 flex items-start gap-2 rounded-xl bg-surface-2 p-2 text-sm text-muted"
            >
              <AlertTriangle
                size={16}
                className="mt-0.5 shrink-0 text-warning"
                aria-hidden="true"
              />
              {localizeServiceMessage(warning)}
            </p>
          ))}

          <FeedbackView feedback={review.feedback} />

          {review.proposals.length > 0 ? (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold">
                {t('aiAnalyses.review.proposals', {
                  value: review.proposals.length,
                })}
              </h3>
              <p className="mb-2 text-xs leading-relaxed text-muted">
                {t('aiAnalyses.review.proposalHint')}
              </p>
              <div className="grid gap-2">
                {review.proposals.map((proposal) => (
                  <ProposalCard
                    key={proposal.proposalId}
                    proposal={proposal}
                    selectable={proposal.status === 'pending'}
                    selected={selected.has(proposal.proposalId)}
                    onToggle={() =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (next.has(proposal.proposalId))
                          next.delete(proposal.proposalId);
                        else next.add(proposal.proposalId);
                        return next;
                      })
                    }
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">
              {t('aiAnalyses.review.noProposals')}
            </p>
          )}

          <div className="mt-4 grid gap-2">
            <Button variant="primary" disabled={busy} onClick={() => void handleCommit()}>
              <Check size={18} aria-hidden="true" />
              {pendingCount > 0
                ? t('aiAnalyses.review.applySelected', {
                    selected: selected.size,
                    total: pendingCount,
                  })
                : t('aiAnalyses.review.save')}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="mb-4">
          <CardHeader
            title={t('aiAnalyses.import.title')}
            subtitle={t('aiAnalyses.import.subtitle')}
            as="h2"
          />
          <div className="grid gap-3">
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
            <Button variant="secondary" onClick={() => fileInput.current?.click()}>
              <Upload size={18} aria-hidden="true" />
              {t('aiAnalyses.import.choose')}
            </Button>
            <TextAreaField
              label={t('aiAnalyses.import.paste')}
              value={paste}
              rows={4}
              placeholder={t('aiAnalyses.import.pastePlaceholder')}
              onChange={(event) => setPaste(event.target.value)}
            />
            <Button
              variant="secondary"
              disabled={!paste.trim()}
              onClick={() => void handlePaste()}
            >
              <ClipboardPaste size={18} aria-hidden="true" />
              {t('aiAnalyses.import.checkPaste')}
            </Button>
          </div>
        </Card>
      )}

      <h2 className="mb-2 text-base font-semibold">{t('aiAnalyses.history.title')}</h2>
      {analyses.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={26} aria-hidden="true" />}
          title={t('aiAnalyses.history.emptyTitle')}
          description={t('aiAnalyses.history.emptyDescription')}
        />
      ) : (
        <ul className="grid gap-2">
          {analyses.map((analysis) => {
            const applied = analysis.proposals.filter(
              (p) => p.status === 'applied',
            ).length;
            const open = expanded === analysis.id;
            return (
              <li
                key={analysis.id}
                className="rounded-2xl border border-border bg-surface p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setExpanded(open ? null : analysis.id)}
                    aria-expanded={open}
                  >
                    <p className="truncate font-medium">
                      {analysis.headline ||
                        analysis.summary ||
                        t('aiAnalyses.history.fallbackTitle')}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDateTime(analysis.importedAt)} ·{' '}
                      {analysis.proposals.length === 1
                        ? t('aiAnalyses.history.proposalOne')
                        : t('aiAnalyses.history.proposalOther', {
                            value: analysis.proposals.length,
                          })}
                      {applied > 0
                        ? t('aiAnalyses.history.applied', { value: applied })
                        : ''}
                    </p>
                  </button>
                  <button
                    type="button"
                    aria-label={t('aiAnalyses.history.deleteLabel')}
                    className="shrink-0 touch-target text-muted"
                    onClick={() => setRemove(analysis)}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>

                {analysis.undoneAt ? (
                  <p className="mt-2 text-xs text-muted">
                    <Badge tone="default">{t('aiAnalyses.history.undone')}</Badge>
                  </p>
                ) : analysis.id === undoableId ? (
                  <div className="mt-2">
                    <Button variant="ghost" size="sm" onClick={() => setUndo(analysis)}>
                      <Undo2 size={16} aria-hidden="true" />
                      {t('aiAnalyses.history.undo')}
                    </Button>
                  </div>
                ) : null}

                {open ? (
                  <div className="mt-3 border-t border-border pt-3">
                    <FeedbackView
                      feedback={{
                        headline: analysis.headline,
                        summary: analysis.summary,
                        strengths: analysis.strengths,
                        observations: analysis.observations,
                        recommendations: analysis.recommendations,
                        nextAnalysisAfter: analysis.nextAnalysisAfter,
                      }}
                    />
                    {analysis.proposals.length > 0 ? (
                      <div className="mt-3 grid gap-2">
                        {analysis.proposals.map((proposal) => (
                          <ProposalCard
                            key={proposal.proposalId}
                            proposal={proposal}
                            selectable={false}
                            selected={false}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={undo != null}
        title={t('aiAnalyses.undoDialog.title')}
        description={t('aiAnalyses.undoDialog.description')}
        confirmLabel={t('aiAnalyses.undoDialog.confirm')}
        cancelLabel={tCommon('action.cancel')}
        onCancel={() => setUndo(null)}
        onConfirm={() => {
          if (undo) void handleUndo(undo);
        }}
      />

      <ConfirmDialog
        open={remove != null}
        title={t('aiAnalyses.deleteDialog.title')}
        description={t('aiAnalyses.deleteDialog.description')}
        confirmLabel={tCommon('action.delete')}
        cancelLabel={tCommon('action.cancel')}
        destructive
        onCancel={() => setRemove(null)}
        onConfirm={async () => {
          if (remove) await deleteAiAnalysis(remove.id);
          setRemove(null);
          toast.show(t('aiAnalyses.toast.deleted'), 'info');
        }}
      />
    </>
  );
}
