import { Link2, Link2Off } from 'lucide-react';
import { Segmented } from '@/components/ui/Field';
import { SessionExerciseCard } from '@/features/session/SessionExerciseCard';
import {
  attachSessionExerciseToPrevious,
  detachSessionExercise,
  setSessionGroupOptions,
  type SessionDetail,
} from '@/db/repositories/sessions';
import {
  computeGroupProgress,
  DEFAULT_GROUP_REST_MODE,
  DEFAULT_GROUP_TYPE,
  GROUP_TYPE_LABELS,
  groupItems,
  memberLabel,
} from '@/services/grouping';
import type { GroupRestMode, GroupType, TemplateExercise } from '@/types';

/**
 * The exercise list of a running workout, laid out as superset/circuit blocks.
 *
 * Grouped exercises get a shared header showing the current round and which
 * exercise is next, so the order is obvious without the app ever navigating on
 * the user's behalf.
 */
export function LiveExerciseList({
  detail,
  sessionId,
  targets,
  soundEnabled,
  vibrationEnabled,
}: {
  detail: SessionDetail;
  sessionId: string;
  targets?: Map<string, TemplateExercise>;
  soundEnabled?: boolean;
  vibrationEnabled?: boolean;
}) {
  const entries = detail.exercises;
  const detailById = new Map(entries.map((entry) => [entry.sessionExercise.id, entry]));
  const indexById = new Map(entries.map((entry, index) => [entry.sessionExercise.id, index]));
  const blocks = groupItems(entries.map((entry) => entry.sessionExercise));

  return (
    <div className="grid gap-3">
      {blocks.map((block) => {
        const memberIds = block.members.map((member) => member.id);
        const completedByMember = new Map<string, number>();
        const plannedByMember = new Map<string, number>();
        for (const member of block.members) {
          const entry = detailById.get(member.id);
          const sets = entry?.sets ?? [];
          completedByMember.set(member.id, sets.filter((set) => set.completedAt).length);
          plannedByMember.set(
            member.id,
            Math.max(sets.length, entry?.sessionExercise.targetSetsSnapshot ?? 0),
          );
        }
        const progress =
          block.groupId != null
            ? computeGroupProgress(memberIds, completedByMember, plannedByMember)
            : null;

        const cards = block.members.map((member, memberIndex) => {
          const entry = detailById.get(member.id);
          if (!entry) return null;
          const globalIndex = indexById.get(member.id) ?? 0;
          const grouped = block.groupId != null;
          return (
            <div key={member.id} className="grid gap-1.5">
              <SessionExerciseCard
                detail={entry}
                sessionId={sessionId}
                index={globalIndex}
                total={entries.length}
                target={targets?.get(entry.sessionExercise.exerciseId)}
                label={memberLabel(block, memberIndex)}
                highlightNext={progress?.nextMemberId === member.id}
                soundEnabled={soundEnabled}
                vibrationEnabled={vibrationEnabled}
              />
              {grouped ? (
                <button
                  type="button"
                  onClick={() => void detachSessionExercise(member.id)}
                  className="inline-flex min-h-[44px] items-center gap-1.5 self-start px-1 text-sm font-medium text-accent"
                >
                  <Link2Off size={16} aria-hidden="true" />
                  Aus Gruppe lösen
                </button>
              ) : globalIndex > 0 ? (
                <button
                  type="button"
                  onClick={() => void attachSessionExerciseToPrevious(member.id)}
                  className="inline-flex min-h-[44px] items-center gap-1.5 self-start px-1 text-sm font-medium text-accent"
                >
                  <Link2 size={16} aria-hidden="true" />
                  Mit Übung darüber gruppieren
                </button>
              ) : null}
            </div>
          );
        });

        if (block.groupId == null) return cards;

        const groupType = block.groupType ?? DEFAULT_GROUP_TYPE;
        const groupRestMode = block.groupRestMode ?? DEFAULT_GROUP_REST_MODE;
        return (
          <section
            key={block.key}
            aria-label={`${GROUP_TYPE_LABELS[groupType]} ${block.letter}`}
            className="rounded-2xl border border-accent/40 bg-surface-2/40 p-2"
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-accent px-2 text-sm font-bold text-accent-contrast">
                  {block.letter}
                </span>
                <span className="text-sm font-semibold">{GROUP_TYPE_LABELS[groupType]}</span>
              </div>
              {progress ? (
                <span className="numeric text-sm text-muted">
                  {progress.done
                    ? 'Runden abgeschlossen'
                    : `Runde ${progress.currentRound} von ${progress.totalRounds}`}
                </span>
              ) : null}
            </div>
            <Segmented
              label="Pause"
              className="mb-2"
              value={groupRestMode}
              onChange={(value) =>
                void setSessionGroupOptions(sessionId, block.groupId as string, {
                  groupRestMode: value as GroupRestMode,
                })
              }
              options={[
                { value: 'round', label: 'Pause nach Runde' },
                { value: 'each', label: 'Pause nach Übung' },
              ]}
            />
            <Segmented
              label="Gruppentyp"
              className="mb-2"
              value={groupType}
              onChange={(value) =>
                void setSessionGroupOptions(sessionId, block.groupId as string, {
                  groupType: value as GroupType,
                })
              }
              options={[
                { value: 'superset', label: 'Supersatz' },
                { value: 'circuit', label: 'Zirkel' },
              ]}
            />
            <div className="grid gap-2">{cards}</div>
          </section>
        );
      })}
    </div>
  );
}
