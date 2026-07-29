import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetDatabase } from '@/tests/dbTestUtils';
import { createExercise } from '@/db/repositories/exercises';
import {
  addExerciseToWorkoutUnit,
  createWorkoutUnit,
} from '@/db/repositories/workoutUnits';
import { StartFreeDialog } from '@/features/home/StartFreeDialog';

beforeEach(async () => {
  await resetDatabase();
});

async function seedUnit() {
  const bench = await createExercise({
    name: 'Bankdrücken',
    primaryMuscleGroup: 'Brust',
    secondaryMuscleGroups: [],
    equipment: '',
    trackingType: 'weight_reps',
    weightMode: 'total',
    weightMultiplier: 1,
    defaultRestSeconds: 90,
    notes: '',
  });
  const unit = await createWorkoutUnit({ name: 'Push', description: '' });
  await addExerciseToWorkoutUnit(unit.id, bench);
  return unit;
}

describe('StartFreeDialog', () => {
  it('starts an empty session when choosing to add exercises yourself', async () => {
    const onStartEmpty = vi.fn();
    const onStartUnit = vi.fn();
    render(
      <StartFreeDialog
        open
        onClose={vi.fn()}
        onStartEmpty={onStartEmpty}
        onStartUnit={onStartUnit}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: /Übungen selbst hinzufügen/ }),
    );
    expect(onStartEmpty).toHaveBeenCalledTimes(1);
    expect(onStartUnit).not.toHaveBeenCalled();
  });

  it('starts from a library unit when one is picked', async () => {
    const unit = await seedUnit();
    const onStartUnit = vi.fn();
    render(
      <StartFreeDialog
        open
        onClose={vi.fn()}
        onStartEmpty={vi.fn()}
        onStartUnit={onStartUnit}
      />,
    );
    await userEvent.click(await screen.findByRole('button', { name: /Push/ }));
    expect(onStartUnit).toHaveBeenCalledWith(unit.id);
  });
});
