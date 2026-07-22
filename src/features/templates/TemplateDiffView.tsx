import { Badge } from '@/components/ui/Card';
import type { TemplateDiff, TemplateEntryStatus } from '@/services/templateDiff';

const STATUS_LABEL: Record<TemplateEntryStatus, string> = {
  added: 'Neu',
  removed: 'Entfernt',
  changed: 'Geändert',
  moved: 'Verschoben',
  unchanged: 'Unverändert',
};

const STATUS_TONE: Record<
  TemplateEntryStatus,
  'success' | 'danger' | 'accent' | 'default'
> = {
  added: 'success',
  removed: 'danger',
  changed: 'accent',
  moved: 'default',
  unchanged: 'default',
};

/**
 * Renders a plan diff. Used both for comparing saved versions and for previewing
 * a proposed change before it is applied. Unchanged exercises are summarised as
 * a count rather than listed, so the actual changes stand out.
 */
export function TemplateDiffView({ diff }: { diff: TemplateDiff }) {
  if (!diff.hasChanges) {
    return <p className="text-sm text-muted">Keine Unterschiede.</p>;
  }

  const changed = diff.entries.filter((entry) => entry.status !== 'unchanged');
  const unchangedCount = diff.entries.length - changed.length;

  return (
    <div className="grid gap-3">
      {diff.nameChange ? (
        <div className="rounded-xl bg-surface-2 p-3 text-sm">
          <span className="text-muted">Name: </span>
          <span className="line-through">{diff.nameChange.before || '–'}</span>
          {' → '}
          <span className="font-medium">{diff.nameChange.after || '–'}</span>
        </div>
      ) : null}

      {diff.descriptionChanged ? (
        <p className="text-sm text-muted">Die Beschreibung wurde geändert.</p>
      ) : null}

      <ul className="grid gap-2">
        {changed.map((entry) => (
          <li
            key={`${entry.exerciseId}-${entry.fromOrder ?? 'x'}-${entry.toOrder ?? 'x'}`}
            className="rounded-xl border border-border bg-surface p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-medium">{entry.name}</span>
              <Badge tone={STATUS_TONE[entry.status]}>{STATUS_LABEL[entry.status]}</Badge>
            </div>
            {entry.changes.length > 0 ? (
              <dl className="mt-2 grid gap-1 text-sm">
                {entry.changes.map((change) => (
                  <div
                    key={change.label}
                    className="flex flex-wrap items-baseline gap-x-2"
                  >
                    <dt className="text-muted">{change.label}:</dt>
                    <dd className="numeric">
                      <span className="line-through text-muted">{change.before}</span>
                      {' → '}
                      <span className="font-medium">{change.after}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </li>
        ))}
      </ul>

      {unchangedCount > 0 ? (
        <p className="text-xs text-muted">{unchangedCount} Übung(en) unverändert.</p>
      ) : null}
    </div>
  );
}
