import type { GroupRestMode, GroupType } from '@/types';

/**
 * Superset / circuit grouping logic.
 *
 * A group is a run of *consecutive* items (by `order`) that share the same
 * `groupId`. An item without a `groupId` is a standalone exercise — the default
 * for everything created before groups existed, which is what keeps old
 * templates and sessions working unchanged.
 *
 * Everything here is pure so the rounds, labels and rest boundaries can be
 * asserted without a database or a rendered component.
 */

export const GROUP_TYPE_LABELS: Record<GroupType, string> = {
  superset: 'Supersatz',
  circuit: 'Zirkel',
};

export const GROUP_REST_MODE_LABELS: Record<GroupRestMode, string> = {
  each: 'Pause nach jeder Übung',
  round: 'Pause nach jeder Runde',
};

export const DEFAULT_GROUP_TYPE: GroupType = 'superset';
export const DEFAULT_GROUP_REST_MODE: GroupRestMode = 'round';

export interface Groupable {
  id: string;
  order: number;
  groupId?: string;
  groupType?: GroupType;
  groupRestMode?: GroupRestMode;
}

export interface Block<T extends Groupable> {
  /** Stable key for React: the groupId, or the single item's id. */
  key: string;
  groupId: string | null;
  groupType: GroupType | null;
  groupRestMode: GroupRestMode | null;
  members: T[];
  /** Block letter: A, B, C … */
  letter: string;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function blockLetter(index: number): string {
  if (index < LETTERS.length) return LETTERS[index];
  const first = Math.floor(index / LETTERS.length) - 1;
  return LETTERS[first] + LETTERS[index % LETTERS.length];
}

/**
 * Splits an ordered list of items into blocks. Consecutive items with the same
 * non-empty `groupId` form one block; everything else is its own single block.
 */
export function groupItems<T extends Groupable>(items: T[]): Block<T>[] {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const blocks: Block<T>[] = [];

  for (const item of sorted) {
    const last = blocks[blocks.length - 1];
    if (item.groupId && last && last.groupId === item.groupId) {
      last.members.push(item);
      // A block's type/rest mode is taken from its first member that declares one.
      last.groupType = last.groupType ?? item.groupType ?? null;
      last.groupRestMode = last.groupRestMode ?? item.groupRestMode ?? null;
    } else {
      blocks.push({
        key: item.groupId ?? item.id,
        groupId: item.groupId ?? null,
        groupType: item.groupId ? (item.groupType ?? DEFAULT_GROUP_TYPE) : null,
        groupRestMode: item.groupId ? (item.groupRestMode ?? DEFAULT_GROUP_REST_MODE) : null,
        members: [item],
        letter: '',
      });
    }
  }

  blocks.forEach((block, index) => {
    block.letter = blockLetter(index);
  });
  return blocks;
}

/** "A1"/"A2" inside a group, or plain "A" for a standalone exercise. */
export function memberLabel<T extends Groupable>(block: Block<T>, memberIndex: number): string {
  return block.groupId ? `${block.letter}${memberIndex + 1}` : block.letter;
}

export interface NormalizedFields {
  groupId?: string;
  groupType?: GroupType;
  groupRestMode?: GroupRestMode;
}

/**
 * The group fields each item *should* have so the grouping invariants hold:
 * a group needs at least two members, every member shares one id/type/rest
 * mode, and each contiguous group gets a unique id. Used after any structural
 * change (add, remove, reorder, attach, detach) to repair single-member
 * leftovers, unify options, and split runs that a deletion left sharing an id.
 *
 * `newId` mints an id for a block that has none yet or whose id collides with an
 * earlier block; existing unique ids are kept so groups stay stable across
 * edits. Returns the desired fields keyed by item id.
 */
export function planGroupNormalization<T extends Groupable>(
  items: T[],
  newId: () => string,
): Map<string, NormalizedFields> {
  const blocks = groupItems(items);
  const plan = new Map<string, NormalizedFields>();
  const usedIds = new Set<string>();

  for (const block of blocks) {
    if (!block.groupId || block.members.length < 2) {
      // Standalone, or a group that collapsed to one member: strip group fields.
      for (const member of block.members) plan.set(member.id, {});
      continue;
    }
    // Keep the existing id when it is unique; otherwise a split left two runs
    // sharing it, so this run needs a fresh one.
    const groupId = usedIds.has(block.groupId) ? newId() : block.groupId;
    usedIds.add(groupId);

    const groupType = block.groupType ?? DEFAULT_GROUP_TYPE;
    const groupRestMode = block.groupRestMode ?? DEFAULT_GROUP_REST_MODE;
    for (const member of block.members) {
      plan.set(member.id, { groupId, groupType, groupRestMode });
    }
  }

  return plan;
}

/** True when the two field sets differ in any group property. */
export function groupingChanged(a: NormalizedFields, b: NormalizedFields): boolean {
  return (
    a.groupId !== b.groupId ||
    a.groupType !== b.groupType ||
    a.groupRestMode !== b.groupRestMode
  );
}

export interface GroupProgress {
  currentRound: number;
  totalRounds: number;
  /** Id of the member whose turn it is next, or null when the group is done. */
  nextMemberId: string | null;
  done: boolean;
}

/**
 * Round progress for a group during a live workout.
 *
 * A "round" is one pass through every member. `completedByMember` is the number
 * of completed working-relevant sets per member id; `plannedByMember` is how
 * many sets are laid out (completed or not), used to know how many rounds the
 * group is aiming for.
 */
export function computeGroupProgress(
  memberIds: string[],
  completedByMember: Map<string, number>,
  plannedByMember: Map<string, number>,
): GroupProgress {
  const completed = memberIds.map((id) => completedByMember.get(id) ?? 0);
  const planned = memberIds.map((id) =>
    Math.max(plannedByMember.get(id) ?? 0, completedByMember.get(id) ?? 0, 1),
  );
  const totalRounds = Math.max(1, ...planned);
  const minCompleted = Math.min(...completed);

  const done = completed.every((count, index) => count >= planned[index]);
  // The next exercise is the first member (in order) that is still behind the
  // current round, i.e. sitting at the group minimum.
  const nextIndex = done ? -1 : completed.findIndex((count) => count === minCompleted);
  const currentRound = done ? totalRounds : Math.min(totalRounds, minCompleted + 1);

  return {
    currentRound,
    totalRounds,
    nextMemberId: nextIndex >= 0 ? memberIds[nextIndex] : null,
    done,
  };
}

/**
 * Whether completing a set just closed a round, so the round-based rest should
 * start. `completedByMember` must already include the set that was just
 * completed. The boundary is reached when the member that just finished is the
 * last one to catch up to the group minimum — i.e. its count equals the minimum
 * across the group.
 */
export function roundBoundaryReached(
  memberIds: string[],
  completedByMember: Map<string, number>,
  completedMemberId: string,
): boolean {
  if (memberIds.length <= 1) return true;
  const counts = memberIds.map((id) => completedByMember.get(id) ?? 0);
  const min = Math.min(...counts);
  return (completedByMember.get(completedMemberId) ?? 0) === min;
}
