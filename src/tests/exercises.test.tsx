import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { db } from '@/db/db';
import { createExercise } from '@/db/repositories/exercises';
import {
  addExerciseToSession,
  finishSession,
  startFreeSession,
} from '@/db/repositories/sessions';
import { ToastProvider } from '@/components/ui/ToastProvider';
import ExercisesPage from '@/pages/ExercisesPage';
import { resetDatabase } from '@/tests/dbTestUtils';

function renderExercises() {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <ExercisesPage />
      </MemoryRouter>
    </ToastProvider>,
  );
}

const BASE = {
  primaryMuscleGroup: 'Brust',
  secondaryMuscleGroups: [],
  equipment: 'Langhantel',
  trackingType: 'weight_reps' as const,
  weightMode: 'total' as const,
  weightMultiplier: 1,
  defaultRestSeconds: 120,
  notes: '',
};

beforeEach(async () => {
  await resetDatabase();
});

describe('exercise management', () => {
  it('explains the empty state instead of shipping preset exercises', async () => {
    renderExercises();

    expect(await screen.findByText(/Noch keine Übungen/)).toBeInTheDocument();
    expect(await db.exercises.count()).toBe(0);
  });

  it('creates an exercise through the form', async () => {
    const user = userEvent.setup();
    renderExercises();

    await user.click(await screen.findByRole('button', { name: /Erste Übung anlegen/ }));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/^Name$/), 'Klimmzüge');
    await user.type(within(dialog).getByLabelText(/Primäre Muskelgruppe/), 'Rücken');
    await user.selectOptions(
      within(dialog).getByLabelText(/Tracking-Typ/),
      'bodyweight_reps',
    );

    await user.click(within(dialog).getByRole('button', { name: /^Speichern$/ }));

    await waitFor(async () => {
      const exercises = await db.exercises.toArray();
      expect(exercises).toHaveLength(1);
      expect(exercises[0].name).toBe('Klimmzüge');
      expect(exercises[0].trackingType).toBe('bodyweight_reps');
      // Choosing a bodyweight type switches the weight convention along with it.
      expect(exercises[0].weightMode).toBe('added_weight');
    });
  });

  it('rejects a duplicate name', async () => {
    const user = userEvent.setup();
    await createExercise({ ...BASE, name: 'Bankdrücken' });
    renderExercises();

    await user.click(await screen.findByRole('button', { name: /^Neu$/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/^Name$/), 'bankdrücken');
    await user.click(within(dialog).getByRole('button', { name: /^Speichern$/ }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      /existiert bereits/,
    );
    expect(await db.exercises.count()).toBe(1);
  });

  it('asks for a weight multiplier only for per-hand exercises', async () => {
    const user = userEvent.setup();
    renderExercises();

    await user.click(await screen.findByRole('button', { name: /^Neu$/ }));
    const dialog = await screen.findByRole('dialog');

    expect(
      within(dialog).queryByLabelText(/Gewichtsmultiplikator/),
    ).not.toBeInTheDocument();

    await user.selectOptions(
      within(dialog).getByLabelText(/Gewichtskonvention/),
      'per_hand',
    );
    expect(within(dialog).getByLabelText(/Gewichtsmultiplikator/)).toBeInTheDocument();
  });

  it('filters the list by search term', async () => {
    const user = userEvent.setup();
    await createExercise({ ...BASE, name: 'Bankdrücken' });
    await createExercise({ ...BASE, name: 'Kniebeugen', primaryMuscleGroup: 'Beine' });
    renderExercises();

    await screen.findByText('Bankdrücken');
    await user.type(screen.getByLabelText(/Suchen/), 'Knie');

    await waitFor(() => {
      expect(screen.queryByText('Bankdrücken')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Kniebeugen')).toBeInTheDocument();
  });

  it('archives an exercise and can restore it', async () => {
    const user = userEvent.setup();
    const exercise = await createExercise({ ...BASE, name: 'Bankdrücken' });
    renderExercises();

    await user.click(
      await screen.findByRole('button', { name: /Bankdrücken archivieren/ }),
    );

    await waitFor(async () => {
      expect((await db.exercises.get(exercise.id))?.archived).toBe(true);
    });

    // Archived entries are hidden until they are explicitly shown again.
    await user.click(await screen.findByLabelText(/Archivierte Übungen anzeigen/));
    await user.click(
      await screen.findByRole('button', { name: /Bankdrücken wiederherstellen/ }),
    );

    await waitFor(async () => {
      expect((await db.exercises.get(exercise.id))?.archived).toBe(false);
    });
  });

  it('refuses to delete an exercise that has already been trained', async () => {
    const user = userEvent.setup();
    const exercise = await createExercise({ ...BASE, name: 'Bankdrücken' });
    const session = await startFreeSession();
    await addExerciseToSession(session.id, exercise);
    await finishSession(session.id);

    renderExercises();
    await user.click(await screen.findByRole('button', { name: /Bankdrücken löschen/ }));

    // No confirmation dialog: the action is refused with an explanation.
    expect(await screen.findByRole('status')).toHaveTextContent(
      /kann nicht gelöscht werden/,
    );
    expect(await db.exercises.count()).toBe(1);
  });

  it('deletes an exercise that was never used, after confirmation', async () => {
    const user = userEvent.setup();
    await createExercise({ ...BASE, name: 'Bankdrücken' });

    renderExercises();
    await user.click(await screen.findByRole('button', { name: /Bankdrücken löschen/ }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Endgültig löschen/ }));

    await waitFor(async () => {
      expect(await db.exercises.count()).toBe(0);
    });
  });
});
