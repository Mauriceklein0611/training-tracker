import { describe, expect, it } from 'vitest';
import { buildPlanBuilderKit } from '@/services/planPackage/builderKit';
import { planPackageSchema } from '@/services/planPackage/schema';
import { PLAN_BUILDER_KIT_FORMAT } from '@/constants/formats';

describe('buildPlanBuilderKit', () => {
  it('is self-describing and carries the target format', () => {
    const kit = buildPlanBuilderKit();
    expect(kit.format).toBe(PLAN_BUILDER_KIT_FORMAT);
    expect(kit.target.format).toBe('training-plan-package');
    expect(kit.muscleGroups.length).toBeGreaterThan(0);
    expect(kit.rules.length).toBeGreaterThan(0);
  });

  it('ships an example that validates against the real package schema', () => {
    const kit = buildPlanBuilderKit();
    expect(() => planPackageSchema.parse(kit.example)).not.toThrow();
  });

  it('demonstrates a schedule with workout and rest entries', () => {
    const kit = buildPlanBuilderKit();
    const parsed = planPackageSchema.parse(kit.example);
    const schedule = parsed.plans[0].schedule;
    expect(schedule?.mode).toBe('repeating-cycle');
    // Workout entries point at real days of the plan; rest entries are pauses.
    const dayKeys = new Set(parsed.plans[0].days.map((day) => day.dayKey));
    const workoutEntries = schedule!.entries.filter((entry) => entry.type === 'workout');
    const restEntries = schedule!.entries.filter((entry) => entry.type === 'rest');
    expect(workoutEntries.length).toBeGreaterThan(0);
    expect(restEntries.length).toBeGreaterThan(0);
    expect(
      workoutEntries.every((entry) => entry.dayKey && dayKeys.has(entry.dayKey)),
    ).toBe(true);
  });

  it('only lists weight modes that are valid for each tracking type', () => {
    const kit = buildPlanBuilderKit();
    expect(kit.allowedValues.weightModeByTrackingType.duration).toEqual(['none']);
    expect(kit.allowedValues.weightModeByTrackingType.weight_reps).toContain('per_hand');
  });
});
