import { db } from '@/db/db';
import type { AiAnalysis, AiExportRecord } from '@/types';
import { nowIso } from '@/utils/id';

/** Persistence for the AI round-trip: export records and imported analyses. */

const MAX_EXPORT_RECORDS = 40;

/** Notes that an export was generated, so a response can be tied back to it. */
export async function recordAiExport(id: string, fingerprint: string): Promise<void> {
  await db.aiExports.put({ id, fingerprint, createdAt: nowIso() });
  const all = await db.aiExports.toArray();
  if (all.length > MAX_EXPORT_RECORDS) {
    all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    await db.aiExports.bulkDelete(all.slice(0, all.length - MAX_EXPORT_RECORDS).map((r) => r.id));
  }
}

export async function getAiExportRecord(id: string): Promise<AiExportRecord | undefined> {
  return db.aiExports.get(id);
}

export async function listAiExportRecords(): Promise<AiExportRecord[]> {
  return db.aiExports.toArray();
}

export async function saveAiAnalysis(analysis: AiAnalysis): Promise<void> {
  await db.aiAnalyses.put(analysis);
}

export async function listAiAnalyses(): Promise<AiAnalysis[]> {
  const all = await db.aiAnalyses.toArray();
  return all.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
}

export async function getAiAnalysis(id: string): Promise<AiAnalysis | undefined> {
  return db.aiAnalyses.get(id);
}

export async function deleteAiAnalysis(id: string): Promise<void> {
  await db.aiAnalyses.delete(id);
}

/** Import fingerprints already seen, for duplicate-import detection. */
export async function knownImportFingerprints(): Promise<Set<string>> {
  const all = await db.aiAnalyses.toArray();
  return new Set(all.map((analysis) => analysis.importFingerprint));
}
