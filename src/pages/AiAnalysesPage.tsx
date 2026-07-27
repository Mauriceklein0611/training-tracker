import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
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

const STATUS_LABEL: Record<AiProposalStatus, string> = {
  pending: 'offen',
  applied: 'übernommen',
  skipped: 'übersprungen',
  conflict: 'Konflikt',
  invalid: 'ungültig',
};

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

const FIELD_LABELS: Record<string, string> = {
  sets: 'Sätze',
  repMin: 'Wdh. von',
  repMax: 'Wdh. bis',
  restSeconds: 'Pause (s)',
  description: 'Beschreibung',
};

function changeLines(proposal: StoredAiProposal) {
  return Object.entries(proposal.changes).map(([field, to]) => ({
    label: FIELD_LABELS[field] ?? field,
    from: proposal.expected?.[field] != null ? String(proposal.expected[field]) : '–',
    to: String(to),
  }));
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
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">
            {proposal.exerciseName ?? proposal.templateName ?? 'Plan'}
          </p>
          {proposal.templateName && proposal.exerciseName ? (
            <p className="text-xs text-muted">{proposal.templateName}</p>
          ) : null}
        </div>
        <Badge tone={STATUS_TONE[proposal.status]}>{STATUS_LABEL[proposal.status]}</Badge>
      </div>

      <dl className="mt-2 grid gap-1 text-sm">
        {changeLines(proposal).map((line) => (
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
          {proposal.issue}
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
          Übernehmen
        </label>
      ) : null}
    </div>
  );
}

/** Plain-text feedback. Rendered as text nodes only — never as markup. */
function FeedbackView({ feedback }: { feedback: ValidatedAiImport['feedback'] }) {
  return (
    <div className="grid gap-3">
      {feedback.headline ? <p className="font-semibold">{feedback.headline}</p> : null}
      {feedback.summary ? (
        <p className="text-sm leading-relaxed">{feedback.summary}</p>
      ) : null}

      {feedback.strengths.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Stärken
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
            Beobachtungen
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
            Empfehlungen
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
          Empfohlene nächste Analyse ab: {feedback.nextAnalysisAfter}
        </p>
      ) : null}
    </div>
  );
}

export default function AiAnalysesPage() {
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
      toast.show(`Datei abgelehnt: ${result.errors[0]}`, 'error');
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
      toast.show('Die Datei konnte nicht gelesen werden.', 'error');
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
          ? `${applied} Vorschlag/Vorschläge übernommen — du kannst den Import unten rückgängig machen.`
          : 'Analyse gespeichert. Keine Planänderung übernommen.',
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
          ? `Import rückgängig gemacht — ${result.restoredPlans} Plan/Pläne zurückgesetzt.`
          : 'Import als rückgängig markiert. Die betroffenen Pläne gibt es nicht mehr.',
        'success',
      );
    } else {
      toast.show('Dieser Import lässt sich nicht mehr rückgängig machen.', 'error');
    }
  };

  const pendingCount =
    review?.proposals.filter((p) => p.status === 'pending').length ?? 0;

  return (
    <>
      <PageHeader
        title="KI-Analysen"
        subtitle="Antwortdatei importieren — nichts wird ungeprüft übernommen"
        backTo="/mehr"
      />

      {review ? (
        <Card className="mb-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Import prüfen</h2>
            <Button variant="ghost" size="sm" onClick={() => setReview(null)}>
              <X size={16} aria-hidden="true" />
              Verwerfen
            </Button>
          </div>

          {review.duplicate ? (
            <p className="mb-3 flex items-start gap-2 rounded-xl bg-surface-2 p-2 text-sm text-warning">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              Diese Antwortdatei wurde offenbar schon einmal importiert.
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
              {warning}
            </p>
          ))}

          <FeedbackView feedback={review.feedback} />

          {review.proposals.length > 0 ? (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold">
                Planvorschläge ({review.proposals.length})
              </h3>
              <p className="mb-2 text-xs leading-relaxed text-muted">
                Nur ausgewählte, gültige Vorschläge werden übernommen. Vorher wird vom
                aktuellen Plan ein Wiederherstellungspunkt gesichert, sodass du den
                letzten Import jederzeit rückgängig machen kannst.
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
              Diese Analyse enthält keine Planvorschläge.
            </p>
          )}

          <div className="mt-4 grid gap-2">
            <Button variant="primary" disabled={busy} onClick={() => void handleCommit()}>
              <Check size={18} aria-hidden="true" />
              {pendingCount > 0
                ? `Übernehmen (${selected.size} von ${pendingCount})`
                : 'Analyse speichern'}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="mb-4">
          <CardHeader
            title="Antwortdatei importieren"
            subtitle="Die von der KI erzeugte training-ai-response.json"
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
              Datei wählen
            </Button>
            <TextAreaField
              label="… oder JSON einfügen"
              value={paste}
              rows={4}
              placeholder='{ "format": "training-ai-response", … }'
              onChange={(event) => setPaste(event.target.value)}
            />
            <Button
              variant="secondary"
              disabled={!paste.trim()}
              onClick={() => void handlePaste()}
            >
              <ClipboardPaste size={18} aria-hidden="true" />
              Eingefügtes JSON prüfen
            </Button>
          </div>
        </Card>
      )}

      <h2 className="mb-2 text-base font-semibold">Frühere Analysen</h2>
      {analyses.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={26} aria-hidden="true" />}
          title="Noch keine Analysen"
          description="Exportiere deine Daten unter Daten & Sicherung, lade sie bei ChatGPT hoch und importiere hier die Antwortdatei. Feedback wird nur angezeigt; Planänderungen wendest du bewusst und einzeln an."
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
                      {analysis.headline || analysis.summary || 'KI-Analyse'}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDateTime(analysis.importedAt)} · {analysis.proposals.length}{' '}
                      Vorschläge
                      {applied > 0 ? ` · ${applied} übernommen` : ''}
                    </p>
                  </button>
                  <button
                    type="button"
                    aria-label="Analyse löschen"
                    className="shrink-0 touch-target text-muted"
                    onClick={() => setRemove(analysis)}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>

                {analysis.undoneAt ? (
                  <p className="mt-2 text-xs text-muted">
                    <Badge tone="default">rückgängig gemacht</Badge>
                  </p>
                ) : analysis.id === undoableId ? (
                  <div className="mt-2">
                    <Button variant="ghost" size="sm" onClick={() => setUndo(analysis)}>
                      <Undo2 size={16} aria-hidden="true" />
                      Import rückgängig machen
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
        title="Import rückgängig machen?"
        description="Die von diesem Import betroffenen Pläne werden auf den Stand vor dem Import zurückgesetzt. Spätere manuelle Änderungen an diesen Plänen gehen dabei verloren. Trainingsverlauf und abgeschlossene Sessions bleiben unberührt."
        confirmLabel="Rückgängig machen"
        onCancel={() => setUndo(null)}
        onConfirm={() => {
          if (undo) void handleUndo(undo);
        }}
      />

      <ConfirmDialog
        open={remove != null}
        title="Analyse löschen?"
        description="Das gespeicherte Feedback und die Vorschlagsliste werden entfernt. Bereits übernommene Planänderungen bleiben bestehen."
        confirmLabel="Löschen"
        destructive
        onCancel={() => setRemove(null)}
        onConfirm={async () => {
          if (remove) await deleteAiAnalysis(remove.id);
          setRemove(null);
          toast.show('Analyse gelöscht.', 'info');
        }}
      />
    </>
  );
}
