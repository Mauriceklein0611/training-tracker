import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { db } from '@/db/db';
import { resetDatabase } from '@/tests/dbTestUtils';
import { createPlan, getPlanWithDays } from '@/db/repositories/plans';
import { createExercise } from '@/db/repositories/exercises';
import {
  addExerciseToWorkoutUnit,
  createWorkoutUnit,
} from '@/db/repositories/workoutUnits';
import TemplatesPage from '@/pages/TemplatesPage';
import TemplateEditPage from '@/pages/TemplateEditPage';

beforeEach(async () => {
  await resetDatabase();
});

function renderPlans() {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <TemplatesPage />
      </MemoryRouter>
    </ToastProvider>,
  );
}

function renderEditor(planId: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[`/plaene/${planId}`]}>
        <Routes>
          <Route path="/plaene/:planId" element={<TemplateEditPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

describe('creating a split plan', () => {
  it('creates the chosen number of days from a split preset', async () => {
    const user = userEvent.setup();
    renderPlans();

    await user.click(
      await screen.findByRole('button', { name: /Ersten Plan erstellen/ }),
    );
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/^Name$/), 'Muskelaufbau');
    await user.selectOptions(within(dialog).getByLabelText(/Struktur/), 'split:3-day');
    await user.click(within(dialog).getByRole('button', { name: /^Erstellen$/ }));

    await waitFor(async () => {
      expect(await db.trainingPlans.count()).toBe(1);
    });
    const plan = (await db.trainingPlans.toArray())[0];
    const withDays = await getPlanWithDays(plan.id);
    expect(withDays?.days).toHaveLength(3);
    expect(withDays?.days.map((day) => day.name)).toEqual(['Tag A', 'Tag B', 'Tag C']);
  });
});

describe('plan editor day navigation', () => {
  it('shows a tab per day and can add another day', async () => {
    const plan = await createPlan({
      name: 'PPL',
      splitType: '3-day',
      dayNames: ['Push', 'Pull', 'Beine'],
    });
    const user = userEvent.setup();
    renderEditor(plan.id);

    // A tab per day.
    expect(await screen.findByRole('tab', { name: 'Push' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Beine' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Trainingstag hinzufügen/ }));
    // The "+" now opens a dialog offering an empty day or a library import.
    await user.click(await screen.findByRole('button', { name: /Leeren Tag erstellen/ }));

    await waitFor(async () => {
      const withDays = await getPlanWithDays(plan.id);
      expect(withDays?.days).toHaveLength(4);
    });
  });

  it('imports a workout unit from the library as a new day', async () => {
    const user = userEvent.setup();
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
    // A multi-day plan so the "+" (add-day) control is shown.
    const plan = await createPlan({
      name: 'Plan',
      splitType: 'custom',
      dayNames: ['Tag A', 'Tag B'],
    });
    renderEditor(plan.id);

    await user.click(
      await screen.findByRole('button', { name: /Trainingstag hinzufügen/ }),
    );
    // The dialog lists the library unit; tapping it imports it as a new day.
    await user.click(await screen.findByRole('button', { name: /Push/ }));

    await waitFor(async () => {
      const withDays = await getPlanWithDays(plan.id);
      expect(withDays?.days).toHaveLength(3);
      const imported = withDays?.days.find((day) => day.name === 'Push');
      expect(imported).toBeDefined();
      expect(imported?.sourceWorkoutUnitTemplateId).toBe(unit.id);
    });
  });

  it('refuses to delete the last day of a single-day plan', async () => {
    const plan = await createPlan({ name: 'Einzel', splitType: 'single' });
    renderEditor(plan.id);

    // The delete-day control is disabled when only one day remains.
    const deleteButton = await screen.findByRole('button', { name: /Tag löschen/ });
    expect(deleteButton).toBeDisabled();
  });
});
