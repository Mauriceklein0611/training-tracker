import { describe, expect, it } from 'vitest';
import {
  blockLetter,
  computeGroupProgress,
  groupItems,
  memberLabel,
  planGroupNormalization,
  roundBoundaryReached,
  type Groupable,
} from '@/services/grouping';

function item(id: string, order: number, groupId?: string): Groupable {
  return { id, order, groupId };
}

let idCounter = 0;
const newId = () => `gen-${(idCounter += 1)}`;

describe('groupItems', () => {
  it('keeps standalone exercises as single blocks', () => {
    const blocks = groupItems([item('a', 0), item('b', 1)]);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].groupId).toBeNull();
    expect(blocks[0].letter).toBe('A');
    expect(blocks[1].letter).toBe('B');
  });

  it('merges consecutive members with the same group id', () => {
    const blocks = groupItems([
      item('a', 0, 'g1'),
      item('b', 1, 'g1'),
      item('c', 2),
      item('d', 3, 'g2'),
      item('e', 4, 'g2'),
    ]);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].members.map((m) => m.id)).toEqual(['a', 'b']);
    expect(blocks[1].members.map((m) => m.id)).toEqual(['c']);
    expect(blocks[2].members.map((m) => m.id)).toEqual(['d', 'e']);
    expect(blocks[0].groupType).toBe('superset');
    expect(blocks[0].groupRestMode).toBe('round');
  });

  it('does not merge a group split by a standalone exercise', () => {
    const blocks = groupItems([item('a', 0, 'g1'), item('b', 1), item('c', 2, 'g1')]);
    // Same id but not consecutive: two separate blocks, each with one member.
    expect(blocks).toHaveLength(3);
  });

  it('labels members A1/A2 inside a group and plain letters when standalone', () => {
    const blocks = groupItems([item('a', 0, 'g1'), item('b', 1, 'g1'), item('c', 2)]);
    expect(memberLabel(blocks[0], 0)).toBe('A1');
    expect(memberLabel(blocks[0], 1)).toBe('A2');
    expect(memberLabel(blocks[1], 0)).toBe('B');
  });
});

describe('blockLetter', () => {
  it('counts up A..Z and beyond', () => {
    expect(blockLetter(0)).toBe('A');
    expect(blockLetter(25)).toBe('Z');
    expect(blockLetter(26)).toBe('AA');
  });
});

describe('planGroupNormalization', () => {
  it('dissolves a group that has only one member left', () => {
    const plan = planGroupNormalization([item('a', 0, 'g1'), item('b', 1)], newId);
    expect(plan.get('a')).toEqual({});
    expect(plan.get('b')).toEqual({});
  });

  it('keeps a valid two-member group and fills defaults', () => {
    const plan = planGroupNormalization([item('a', 0, 'g1'), item('b', 1, 'g1')], newId);
    expect(plan.get('a')).toEqual({
      groupId: 'g1',
      groupType: 'superset',
      groupRestMode: 'round',
    });
    expect(plan.get('b')?.groupId).toBe('g1');
  });

  it('gives split runs that share an id distinct new ids', () => {
    // A deletion could leave two runs still carrying "g1".
    const plan = planGroupNormalization(
      [
        item('a', 0, 'g1'),
        item('b', 1, 'g1'),
        item('c', 2), // breaks contiguity
        item('d', 3, 'g1'),
        item('e', 4, 'g1'),
      ],
      newId,
    );
    const firstId = plan.get('a')?.groupId;
    const secondId = plan.get('d')?.groupId;
    expect(firstId).toBe('g1');
    expect(secondId).not.toBe('g1');
    expect(secondId).toBe(plan.get('e')?.groupId);
  });
});

describe('computeGroupProgress', () => {
  const members = ['a', 'b'];

  it('points at the first member at the start of a round', () => {
    const progress = computeGroupProgress(
      members,
      new Map([
        ['a', 0],
        ['b', 0],
      ]),
      new Map([
        ['a', 3],
        ['b', 3],
      ]),
    );
    expect(progress.currentRound).toBe(1);
    expect(progress.totalRounds).toBe(3);
    expect(progress.nextMemberId).toBe('a');
    expect(progress.done).toBe(false);
  });

  it('advances to the lagging member mid-round', () => {
    const progress = computeGroupProgress(
      members,
      new Map([
        ['a', 1],
        ['b', 0],
      ]),
      new Map([
        ['a', 3],
        ['b', 3],
      ]),
    );
    expect(progress.currentRound).toBe(1);
    expect(progress.nextMemberId).toBe('b');
  });

  it('reports done once every member finished every round', () => {
    const progress = computeGroupProgress(
      members,
      new Map([
        ['a', 3],
        ['b', 3],
      ]),
      new Map([
        ['a', 3],
        ['b', 3],
      ]),
    );
    expect(progress.done).toBe(true);
    expect(progress.nextMemberId).toBeNull();
    expect(progress.currentRound).toBe(3);
  });
});

describe('roundBoundaryReached', () => {
  const group = ['a', 'b'];

  it('is false until the last member of the round catches up', () => {
    // After A1 completes its first set: A=1, B=0.
    expect(
      roundBoundaryReached(
        group,
        new Map([
          ['a', 1],
          ['b', 0],
        ]),
        'a',
      ),
    ).toBe(false);
    // After B1 completes its first set: A=1, B=1 → round closed.
    expect(
      roundBoundaryReached(
        group,
        new Map([
          ['a', 1],
          ['b', 1],
        ]),
        'b',
      ),
    ).toBe(true);
  });

  it('always rests for a single-member group', () => {
    expect(roundBoundaryReached(['a'], new Map([['a', 1]]), 'a')).toBe(true);
  });
});
