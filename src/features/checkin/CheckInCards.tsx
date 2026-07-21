import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { TextAreaField } from '@/components/ui/Field';
import { setPostCheckIn, setPreCheckIn } from '@/db/repositories/sessions';
import type { PostWorkoutCheckIn, PreWorkoutCheckIn } from '@/types';
import { RatingScale } from '@/features/checkin/RatingScale';

/** Drops empty fields; returns undefined when nothing is left, i.e. "not filled in". */
function prune<T extends object>(value: T): T | undefined {
  const entries = Object.entries(value).filter(([, v]) => {
    if (v == null) return false;
    if (typeof v === 'string') return v.trim().length > 0;
    return true;
  });
  return entries.length > 0 ? (Object.fromEntries(entries) as T) : undefined;
}

function hasPreCheckIn(value: PreWorkoutCheckIn | undefined): boolean {
  return prune(value ?? {}) !== undefined;
}

function hasPostCheckIn(value: PostWorkoutCheckIn | undefined): boolean {
  return prune(value ?? {}) !== undefined;
}

/** Collapsible shell that keeps a check-in out of the way until wanted. */
function CheckInShell({
  title,
  subtitle,
  filled,
  children,
}: {
  title: string;
  subtitle: string;
  filled: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(filled);
  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight">{title}</h2>
          <p className="mt-0.5 text-sm text-muted">{filled ? 'Ausgefüllt · antippen' : subtitle}</p>
        </div>
        {open ? (
          <ChevronUp size={20} className="shrink-0 text-muted" aria-hidden="true" />
        ) : (
          <ChevronDown size={20} className="shrink-0 text-muted" aria-hidden="true" />
        )}
      </button>
      {open ? <div className="mt-4 grid gap-4">{children}</div> : null}
    </Card>
  );
}

function NoteField({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: string | undefined;
  placeholder: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value ?? '');
  return (
    <TextAreaField
      label={label}
      value={draft}
      rows={2}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onCommit(draft)}
    />
  );
}

export function PreCheckInCard({
  sessionId,
  value,
}: {
  sessionId: string;
  value: PreWorkoutCheckIn | undefined;
}) {
  const current = value ?? {};
  const patch = (changes: Partial<PreWorkoutCheckIn>) => {
    void setPreCheckIn(sessionId, prune({ ...current, ...changes }));
  };

  return (
    <CheckInShell
      title="Vor dem Training"
      subtitle="Optional · in wenigen Sekunden"
      filled={hasPreCheckIn(value)}
    >
      <RatingScale
        label="Energie"
        value={current.energy}
        lowLabel="niedrig"
        highLabel="hoch"
        onChange={(energy) => patch({ energy })}
      />
      <RatingScale
        label="Schlafqualität"
        value={current.sleepQuality}
        lowLabel="schlecht"
        highLabel="gut"
        onChange={(sleepQuality) => patch({ sleepQuality })}
      />
      <RatingScale
        label="Motivation"
        value={current.motivation}
        lowLabel="niedrig"
        highLabel="hoch"
        onChange={(motivation) => patch({ motivation })}
      />
      <RatingScale
        label="Muskelkater"
        value={current.soreness}
        min={0}
        max={5}
        lowLabel="keiner"
        highLabel="stark"
        onChange={(soreness) => patch({ soreness })}
      />
      <NoteField
        label="Schmerz oder Einschränkung"
        value={current.painNote}
        placeholder="z. B. Knie zwickt, Schulter vorsichtig"
        onCommit={(painNote) => patch({ painNote })}
      />
      <NoteField
        label="Notiz"
        value={current.note}
        placeholder="Optional"
        onCommit={(note) => patch({ note })}
      />
    </CheckInShell>
  );
}

export function PostCheckInCard({
  sessionId,
  value,
}: {
  sessionId: string;
  value: PostWorkoutCheckIn | undefined;
}) {
  const current = value ?? {};
  const patch = (changes: Partial<PostWorkoutCheckIn>) => {
    void setPostCheckIn(sessionId, prune({ ...current, ...changes }));
  };

  return (
    <CheckInShell
      title="Nach dem Training"
      subtitle="Optional · wie war die Einheit?"
      filled={hasPostCheckIn(value)}
    >
      <RatingScale
        label="Trainingsqualität"
        value={current.quality}
        lowLabel="schlecht"
        highLabel="top"
        onChange={(quality) => patch({ quality })}
      />
      <RatingScale
        label="Schwierigkeit"
        value={current.difficulty}
        lowLabel="leicht"
        highLabel="sehr schwer"
        onChange={(difficulty) => patch({ difficulty })}
      />
      <RatingScale
        label="Zufriedenheit"
        value={current.satisfaction}
        lowLabel="niedrig"
        highLabel="hoch"
        onChange={(satisfaction) => patch({ satisfaction })}
      />
      <NoteField
        label="Notiz"
        value={current.note}
        placeholder="Optional"
        onCommit={(note) => patch({ note })}
      />
    </CheckInShell>
  );
}
