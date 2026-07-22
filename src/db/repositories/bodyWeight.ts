import { db } from '@/db/db';
import type { BodyMeasurements, BodyWeightEntry } from '@/types';
import { nowIso, uuid } from '@/utils/id';

export interface BodyEntryInput {
  date: string;
  weightKg?: number;
  bodyFatPercent?: number;
  measurements?: BodyMeasurements;
  notes?: string;
}

export async function listBodyWeightEntries(): Promise<BodyWeightEntry[]> {
  const entries = await db.bodyWeightEntries.toArray();
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

/** Strips empty measurements so an entry never stores a bag of undefineds. */
function cleanMeasurements(
  measurements: BodyMeasurements | undefined,
): BodyMeasurements | undefined {
  if (!measurements) return undefined;
  const entries = Object.entries(measurements).filter(
    ([, value]) => typeof value === 'number' && Number.isFinite(value) && value > 0,
  );
  return entries.length > 0
    ? (Object.fromEntries(entries) as BodyMeasurements)
    : undefined;
}

/** True when an entry carries at least one measured value. */
export function hasAnyBodyValue(input: BodyEntryInput): boolean {
  return (
    input.weightKg != null ||
    input.bodyFatPercent != null ||
    Object.values(input.measurements ?? {}).some((value) => value != null)
  );
}

/**
 * Stores one day of body data. One entry per day: saving the same date again
 * merges into the existing row, so adding a measurement later does not wipe the
 * weight that was recorded in the morning.
 */
export async function upsertBodyWeightEntry(
  input: BodyEntryInput,
): Promise<BodyWeightEntry> {
  return db.transaction('rw', db.bodyWeightEntries, async () => {
    const existing = await db.bodyWeightEntries.where('date').equals(input.date).first();
    const timestamp = nowIso();
    const measurements = cleanMeasurements(input.measurements);

    if (existing) {
      const merged: BodyWeightEntry = {
        ...existing,
        // Only overwrite what was actually entered this time.
        weightKg: input.weightKg ?? existing.weightKg,
        bodyFatPercent: input.bodyFatPercent ?? existing.bodyFatPercent,
        measurements:
          measurements || existing.measurements
            ? { ...existing.measurements, ...measurements }
            : undefined,
        notes: input.notes ?? existing.notes,
        updatedAt: timestamp,
      };
      await db.bodyWeightEntries.put(merged);
      return merged;
    }

    const entry: BodyWeightEntry = {
      id: uuid(),
      date: input.date,
      weightKg: input.weightKg,
      bodyFatPercent: input.bodyFatPercent,
      measurements,
      notes: input.notes ?? '',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await db.bodyWeightEntries.add(entry);
    return entry;
  });
}

export async function deleteBodyWeightEntry(id: string): Promise<void> {
  await db.bodyWeightEntries.delete(id);
}

/**
 * Latest and earliest recorded value of one field, plus the difference between
 * them — the basis for the "since the first entry" figures.
 */
export function bodyValueTrend(
  entries: BodyWeightEntry[],
  read: (entry: BodyWeightEntry) => number | undefined,
): { latest: number | null; first: number | null; change: number | null } {
  // `entries` arrives newest first.
  const withValue = entries
    .map((entry) => ({ date: entry.date, value: read(entry) }))
    .filter((item): item is { date: string; value: number } => item.value != null);

  if (withValue.length === 0) return { latest: null, first: null, change: null };
  const latest = withValue[0].value;
  const first = withValue[withValue.length - 1].value;
  return { latest, first, change: withValue.length > 1 ? latest - first : null };
}
