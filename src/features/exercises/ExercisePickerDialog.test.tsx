import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { ExercisePickerDialog } from '@/features/exercises/ExercisePickerDialog';
import { resetDatabase } from '@/tests/dbTestUtils';
import { db } from '@/db/db';

vi.mock('@/utils/exerciseDisplay', () => ({
  exerciseDisplayName: (exercise: { name: string; catalogKey?: string }) =>
    exercise.catalogKey === 'barbell-bench-press' ? 'Bench Press' : exercise.name,
  exerciseSearchText: (exercise: { name: string; catalogKey?: string }) =>
    exercise.catalogKey === 'barbell-bench-press'
      ? `Bench Press ${exercise.name}`
      : exercise.name,
}));

function renderPicker(
  onSelect = vi.fn(),
  props: Partial<React.ComponentProps<typeof ExercisePickerDialog>> = {},
) {
  render(
    <ToastProvider>
      <MemoryRouter>
        <ExercisePickerDialog open onClose={vi.fn()} onSelect={onSelect} {...props} />
      </MemoryRouter>
    </ToastProvider>,
  );
  return { onSelect };
}

beforeEach(async () => {
  await resetDatabase();
});

describe('ExercisePickerDialog — cardio quick-start filter', () => {
  it('lists only cardio exercises when filtered to cardio', async () => {
    const { createExercise } = await import('@/db/repositories/exercises');
    await createExercise({
      name: 'Bankdrücken',
      primaryMuscleGroup: 'Brust',
      secondaryMuscleGroups: [],
      equipment: 'Langhantel',
      trackingType: 'weight_reps',
      weightMode: 'total',
      weightMultiplier: 1,
      defaultRestSeconds: 120,
      notes: '',
    });
    await createExercise({
      name: 'Laufen',
      primaryMuscleGroup: 'Ganzkörper',
      secondaryMuscleGroups: [],
      equipment: '',
      defaultEquipment: 'treadmill',
      trackingType: 'cardio',
      cardioModality: 'running',
      weightMode: 'none',
      weightMultiplier: 1,
      defaultRestSeconds: 60,
      notes: '',
    });

    renderPicker(vi.fn(), { trackingTypeFilter: 'cardio' });

    expect(await screen.findByText('Laufen')).toBeInTheDocument();
    expect(screen.queryByText('Bankdrücken')).not.toBeInTheDocument();
  });
});

describe('ExercisePickerDialog — create from search (Feature 1)', () => {
  it('prefills the create form with the unmatched search term', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.type(await screen.findByLabelText('Suchen'), '  Reverse Back  ');

    // No match → the empty state offers to create the searched exercise.
    const createButton = await screen.findByRole('button', {
      name: /als neue Übung erstellen/,
    });
    await user.click(createButton);

    // The create form opens with the trimmed search term as the name.
    const nameInput = (await screen.findByLabelText(/^Name$/)) as HTMLInputElement;
    expect(nameInput.value).toBe('Reverse Back');
  });
});

describe('ExercisePickerDialog — localized system exercise names', () => {
  it('renders and finds a system exercise through the display helpers', async () => {
    const user = userEvent.setup();
    const timestamp = new Date().toISOString();
    await db.exercises.add({
      id: 'system-bench-press',
      name: 'Bankdrücken',
      origin: 'system',
      catalogKey: 'barbell-bench-press',
      searchTerms: [],
      primaryMuscleGroup: 'Brust',
      secondaryMuscleGroups: [],
      equipment: 'Langhantel',
      trackingType: 'weight_reps',
      weightMode: 'total',
      weightMultiplier: 1,
      defaultRestSeconds: 120,
      notes: '',
      archived: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await db.exercises.add({
      id: 'custom-squat',
      name: 'Kniebeugen',
      origin: 'custom',
      primaryMuscleGroup: 'Beine',
      secondaryMuscleGroups: [],
      equipment: 'Langhantel',
      trackingType: 'weight_reps',
      weightMode: 'total',
      weightMultiplier: 1,
      defaultRestSeconds: 120,
      notes: '',
      archived: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    renderPicker();
    await user.type(await screen.findByLabelText('Suchen'), 'Bench Press');

    expect(await screen.findByText('Bench Press')).toBeInTheDocument();
    expect(screen.queryByText('Kniebeugen')).not.toBeInTheDocument();
  });
});
