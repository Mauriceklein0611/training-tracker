import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { db } from '@/db/db';
import { resetDatabase } from '@/tests/dbTestUtils';
import { createExercise } from '@/db/repositories/exercises';
import { PlanPackageTools } from '@/features/plans/PlanPackageTools';
import { validPlanPackage } from '@/services/planPackage/fixtures';

function renderTools() {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <PlanPackageTools />
      </MemoryRouter>
    </ToastProvider>,
  );
}

function packageFile(data: unknown): File {
  return new File([JSON.stringify(data)], 'plan.json', { type: 'application/json' });
}

beforeEach(async () => {
  await resetDatabase();
});

describe('PlanPackageTools import', () => {
  it('previews a valid package and imports it into the database', async () => {
    const user = userEvent.setup();
    const { container } = renderTools();

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, packageFile(validPlanPackage()));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Push Pull Beine')).toBeInTheDocument();
    // The plan name is offered as an editable field.
    expect(within(dialog).getByDisplayValue('Oberkörper')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /^Importieren$/ }));

    await waitFor(async () => {
      expect(await db.workoutTemplates.count()).toBe(1);
    });
    expect(await db.exercises.count()).toBe(3);
    expect(await db.planImports.count()).toBe(1);
  });

  it('shows a validation error for a malformed package instead of importing', async () => {
    const user = userEvent.setup();
    const { container } = renderTools();

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, packageFile({ format: 'nonsense' }));

    expect(
      await screen.findByText(/Die Datei konnte nicht verwendet werden/),
    ).toBeInTheDocument();
    expect(await db.workoutTemplates.count()).toBe(0);
  });

  it('lets the user reuse an existing exercise on a metadata difference', async () => {
    await createExercise({
      name: 'Bankdrücken',
      primaryMuscleGroup: 'Brust',
      secondaryMuscleGroups: [],
      equipment: 'Kurzhantel',
      trackingType: 'weight_reps',
      weightMode: 'total',
      weightMultiplier: 1,
      defaultRestSeconds: 120,
      notes: '',
    });

    const user = userEvent.setup();
    const { container } = renderTools();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, packageFile(validPlanPackage()));

    const dialog = await screen.findByRole('dialog');
    // The compatible-but-different exercise offers a reuse/new choice.
    expect(within(dialog).getByLabelText('Wie importieren?')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /^Importieren$/ }));

    await waitFor(async () => {
      expect(await db.workoutTemplates.count()).toBe(1);
    });
    // Default resolution for a metadata diff is reuse → no duplicate created.
    const benches = (await db.exercises.toArray()).filter(
      (e) => e.name === 'Bankdrücken',
    );
    expect(benches).toHaveLength(1);
  });
});
