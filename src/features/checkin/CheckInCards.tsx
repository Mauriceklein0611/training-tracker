import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('more');
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
          <p className="mt-0.5 text-sm text-muted">
            {filled ? t('screens.checkIn.filled') : subtitle}
          </p>
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
  const { t } = useTranslation('more');
  const current = value ?? {};
  const patch = (changes: Partial<PreWorkoutCheckIn>) => {
    void setPreCheckIn(sessionId, prune({ ...current, ...changes }));
  };

  return (
    <CheckInShell
      title={t('screens.checkIn.pre.title')}
      subtitle={t('screens.checkIn.pre.subtitle')}
      filled={hasPreCheckIn(value)}
    >
      <RatingScale
        label={t('screens.checkIn.pre.energy')}
        value={current.energy}
        lowLabel={t('screens.checkIn.scale.low')}
        highLabel={t('screens.checkIn.scale.high')}
        onChange={(energy) => patch({ energy })}
      />
      <RatingScale
        label={t('screens.checkIn.pre.sleep')}
        value={current.sleepQuality}
        lowLabel={t('screens.checkIn.scale.bad')}
        highLabel={t('screens.checkIn.scale.good')}
        onChange={(sleepQuality) => patch({ sleepQuality })}
      />
      <RatingScale
        label={t('screens.checkIn.pre.motivation')}
        value={current.motivation}
        lowLabel={t('screens.checkIn.scale.low')}
        highLabel={t('screens.checkIn.scale.high')}
        onChange={(motivation) => patch({ motivation })}
      />
      <RatingScale
        label={t('screens.checkIn.pre.soreness')}
        value={current.soreness}
        min={0}
        max={5}
        lowLabel={t('screens.checkIn.scale.none')}
        highLabel={t('screens.checkIn.scale.strong')}
        onChange={(soreness) => patch({ soreness })}
      />
      <NoteField
        label={t('screens.checkIn.pre.pain')}
        value={current.painNote}
        placeholder={t('screens.checkIn.pre.painPlaceholder')}
        onCommit={(painNote) => patch({ painNote })}
      />
      <NoteField
        label={t('screens.checkIn.pre.note')}
        value={current.note}
        placeholder={t('screens.checkIn.optional')}
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
  const { t } = useTranslation('more');
  const current = value ?? {};
  const patch = (changes: Partial<PostWorkoutCheckIn>) => {
    void setPostCheckIn(sessionId, prune({ ...current, ...changes }));
  };

  return (
    <CheckInShell
      title={t('screens.checkIn.post.title')}
      subtitle={t('screens.checkIn.post.subtitle')}
      filled={hasPostCheckIn(value)}
    >
      <RatingScale
        label={t('screens.checkIn.post.quality')}
        value={current.quality}
        lowLabel={t('screens.checkIn.scale.bad')}
        highLabel={t('screens.checkIn.scale.top')}
        onChange={(quality) => patch({ quality })}
      />
      <RatingScale
        label={t('screens.checkIn.post.difficulty')}
        value={current.difficulty}
        lowLabel={t('screens.checkIn.scale.easy')}
        highLabel={t('screens.checkIn.scale.veryHard')}
        onChange={(difficulty) => patch({ difficulty })}
      />
      <RatingScale
        label={t('screens.checkIn.post.satisfaction')}
        value={current.satisfaction}
        lowLabel={t('screens.checkIn.scale.low')}
        highLabel={t('screens.checkIn.scale.high')}
        onChange={(satisfaction) => patch({ satisfaction })}
      />
      <NoteField
        label={t('screens.checkIn.post.note')}
        value={current.note}
        placeholder={t('screens.checkIn.optional')}
        onCommit={(note) => patch({ note })}
      />
    </CheckInShell>
  );
}
