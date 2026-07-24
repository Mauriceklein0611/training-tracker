import { beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from '@/tests/dbTestUtils';
import { createPlan, getPlanWithDays, listPlans } from '@/db/repositories/plans';
import {
  addCycleEntry,
  getPlanScheduleView,
  setScheduleMode,
} from '@/db/repositories/schedules';
import { buildPlanPackage, type PlanExportInput } from '@/services/planPackage/build';
import { parsePlanPackage } from '@/services/planPackage/parse';
import {
  analyzePlanPackageImport,
  importPlanPackage,
} from '@/services/planPackage/import';
import { getTemplateWithExercises } from '@/db/repositories/templates';
import type { TemplateWithExercises } from '@/db/repositories/templates';
import { validPlanPackage } from '@/services/planPackage/fixtures';

async function exportInputFor(planId: string): Promise<PlanExportInput> {
  const plan = (await getPlanWithDays(planId))!;
  const days = (await Promise.all(
    plan.days.map((day) => getTemplateWithExercises(day.id)),
  )) as TemplateWithExercises[];
  const view = await getPlanScheduleView(planId);
  return {
    plan: plan.plan,
    days,
    schedule: { schedule: view.schedule, entries: view.entries },
  };
}

beforeEach(async () => {
  await resetDatabase();
});

describe('plan package v3 — schedule', () => {
  it('exports a repeating cycle at schemaVersion 3 with day references', async () => {
    const plan = await createPlan({ name: 'PPL', splitType: '2-day' });
    await setScheduleMode(plan.id, 'repeating-cycle'); // 2 workout entries
    await addCycleEntry(plan.id, { type: 'rest', label: 'Pause' });

    const pkg = buildPlanPackage([await exportInputFor(plan.id)], {
      packageName: 'PPL',
      source: 'app-export',
    });

    expect(pkg.schemaVersion).toBe(3);
    const schedule = pkg.plans[0].schedule!;
    expect(schedule.mode).toBe('repeating-cycle');
    expect(schedule.entries.map((e) => e.type)).toEqual(['workout', 'workout', 'rest']);
    // Workout entries reference days that exist in the package.
    const dayKeys = new Set(pkg.plans[0].days.map((d) => d.dayKey));
    for (const entry of schedule.entries) {
      if (entry.type === 'workout') expect(dayKeys.has(entry.dayKey!)).toBe(true);
    }
    // No internal ids leak.
    expect(JSON.stringify(pkg)).not.toContain(plan.id);
  });

  it('round-trips a cycle: export → import recreates the schedule on new day ids', async () => {
    const plan = await createPlan({ name: 'PPL', splitType: '2-day' });
    await setScheduleMode(plan.id, 'repeating-cycle');
    await addCycleEntry(plan.id, { type: 'rest' });
    const pkg = buildPlanPackage([await exportInputFor(plan.id)], {
      packageName: 'PPL',
      source: 'app-export',
    });

    await resetDatabase();
    const analysis = analyzePlanPackageImport(pkg, [], []);
    await importPlanPackage(pkg, analysis);

    const [imported] = await listPlans();
    const view = await getPlanScheduleView(imported.id);
    expect(view.schedule.mode).toBe('repeating-cycle');
    expect(view.entries.map((e) => e.type)).toEqual(['workout', 'workout', 'rest']);
    const unitIds = new Set(view.units.map((u) => u.id));
    for (const entry of view.entries) {
      if (entry.type === 'workout') expect(unitIds.has(entry.templateId!)).toBe(true);
    }
  });

  it('imports a version-2 file (no schedule) as a free-rotation', async () => {
    // The v2 fixture carries no schedule.
    const parsed = parsePlanPackage(JSON.stringify(validPlanPackage()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const analysis = analyzePlanPackageImport(parsed.data, [], []);
    await importPlanPackage(parsed.data, analysis);
    const [imported] = await listPlans();
    const view = await getPlanScheduleView(imported.id);
    expect(view.schedule.mode).toBe('free-rotation');
    expect(view.entries).toHaveLength(0);
  });

  it('rejects a schedule that references an unknown dayKey', () => {
    const pkg = validPlanPackage() as Record<string, unknown>;
    pkg.schemaVersion = 3;
    (pkg.plans as Record<string, unknown>[])[0].schedule = {
      mode: 'repeating-cycle',
      entries: [{ type: 'workout', dayKey: 'does-not-exist', position: 0 }],
    };
    const result = parsePlanPackage(JSON.stringify(pkg));
    expect(result.ok).toBe(false);
  });
});
