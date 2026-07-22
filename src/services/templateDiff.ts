import type { GroupRestMode, GroupType, TemplateExerciseSnapshot, TemplateVersionSnapshot } from '@/types';
import { GROUP_REST_MODE_LABELS, GROUP_TYPE_LABELS } from '@/services/grouping';

/**
 * Pure diff between two plan snapshots.
 *
 * Used both for comparing saved plan versions and for previewing a proposed
 * change before it is applied, so it stays free of any database or UI concern.
 * Exercises are matched by their exercise id (repeated exercises are paired in
 * order); everything else is reported as a field-level change.
 */

export type TemplateEntryStatus = 'added' | 'removed' | 'changed' | 'moved' | 'unchanged';

export interface FieldChange {
  label: string;
  before: string;
  after: string;
}

export interface TemplateDiffEntry {
  exerciseId: string;
  name: string;
  status: TemplateEntryStatus;
  fromOrder: number | null;
  toOrder: number | null;
  changes: FieldChange[];
}

export interface TemplateDiff {
  nameChange: { before: string; after: string } | null;
  descriptionChanged: boolean;
  entries: TemplateDiffEntry[];
  hasChanges: boolean;
}

function num(value: number | undefined): string {
  return value == null ? '–' : String(value);
}

function repRange(exercise: TemplateExerciseSnapshot): string {
  if (exercise.targetRepMin != null && exercise.targetRepMax != null) {
    return `${exercise.targetRepMin}–${exercise.targetRepMax}`;
  }
  if (exercise.targetRepMin != null) return `ab ${exercise.targetRepMin}`;
  if (exercise.targetRepMax != null) return `bis ${exercise.targetRepMax}`;
  return '–';
}

function groupLabel(exercise: TemplateExerciseSnapshot): string {
  if (!exercise.groupId) return 'keine';
  const type = GROUP_TYPE_LABELS[(exercise.groupType ?? 'superset') as GroupType];
  const rest = GROUP_REST_MODE_LABELS[(exercise.groupRestMode ?? 'round') as GroupRestMode];
  return `${type} (${rest})`;
}

function fieldChanges(
  before: TemplateExerciseSnapshot,
  after: TemplateExerciseSnapshot,
): FieldChange[] {
  const changes: FieldChange[] = [];
  const push = (label: string, a: string, b: string) => {
    if (a !== b) changes.push({ label, before: a, after: b });
  };
  push('Sätze', num(before.targetSets), num(after.targetSets));
  push('Wiederholungen', repRange(before), repRange(after));
  push('Zieldauer (s)', num(before.targetDurationSeconds), num(after.targetDurationSeconds));
  push('Pause (s)', num(before.restSeconds), num(after.restSeconds));
  push('Notiz', before.notes || '–', after.notes || '–');
  push('Gruppe', groupLabel(before), groupLabel(after));
  return changes;
}

/** Groups a snapshot's exercises by exercise id, preserving order. */
function byExerciseId(
  snapshot: TemplateVersionSnapshot,
): Map<string, TemplateExerciseSnapshot[]> {
  const map = new Map<string, TemplateExerciseSnapshot[]>();
  for (const exercise of [...snapshot.exercises].sort((a, b) => a.order - b.order)) {
    const list = map.get(exercise.exerciseId) ?? [];
    list.push(exercise);
    map.set(exercise.exerciseId, list);
  }
  return map;
}

export function diffTemplateSnapshots(
  before: TemplateVersionSnapshot,
  after: TemplateVersionSnapshot,
): TemplateDiff {
  const beforeById = byExerciseId(before);
  const afterById = byExerciseId(after);
  const exerciseIds = [...new Set([...beforeById.keys(), ...afterById.keys()])];

  const entries: TemplateDiffEntry[] = [];
  for (const exerciseId of exerciseIds) {
    const beforeList = beforeById.get(exerciseId) ?? [];
    const afterList = afterById.get(exerciseId) ?? [];
    const pairs = Math.max(beforeList.length, afterList.length);

    for (let index = 0; index < pairs; index += 1) {
      const a = beforeList[index];
      const b = afterList[index];
      const name = (b ?? a).exerciseNameSnapshot;

      if (a && !b) {
        entries.push({
          exerciseId,
          name,
          status: 'removed',
          fromOrder: a.order,
          toOrder: null,
          changes: [],
        });
      } else if (!a && b) {
        entries.push({
          exerciseId,
          name,
          status: 'added',
          fromOrder: null,
          toOrder: b.order,
          changes: [],
        });
      } else if (a && b) {
        const changes = fieldChanges(a, b);
        const moved = a.order !== b.order;
        entries.push({
          exerciseId,
          name,
          status: changes.length > 0 ? 'changed' : moved ? 'moved' : 'unchanged',
          fromOrder: a.order,
          toOrder: b.order,
          changes,
        });
      }
    }
  }

  // Present in the order they appear in the target plan, added/removed last.
  entries.sort((a, b) => (a.toOrder ?? 999) - (b.toOrder ?? 999));

  const nameChange = before.name !== after.name ? { before: before.name, after: after.name } : null;
  const descriptionChanged = before.description !== after.description;
  const hasChanges =
    nameChange != null ||
    descriptionChanged ||
    entries.some((entry) => entry.status !== 'unchanged');

  return { nameChange, descriptionChanged, entries, hasChanges };
}
