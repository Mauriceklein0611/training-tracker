import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { ExercisePickerDialog } from '@/features/exercises/ExercisePickerDialog';
import { resetDatabase } from '@/tests/dbTestUtils';

function renderPicker(onSelect = vi.fn()) {
  render(
    <ToastProvider>
      <MemoryRouter>
        <ExercisePickerDialog open onClose={vi.fn()} onSelect={onSelect} />
      </MemoryRouter>
    </ToastProvider>,
  );
  return { onSelect };
}

beforeEach(async () => {
  await resetDatabase();
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
