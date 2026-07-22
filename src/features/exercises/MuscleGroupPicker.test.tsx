import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MuscleGroupPicker } from '@/features/exercises/MuscleGroupPicker';
import { MuscleGroupChips } from '@/features/exercises/MuscleGroupChips';

function SingleHarness({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <MuscleGroupPicker
      open
      mode="single"
      title="Primäre Muskelgruppe"
      selected={selected}
      onChange={setSelected}
      onClose={onClose}
    />
  );
}

function MultiHarness({ excludeLabels = [] as string[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <>
      <MuscleGroupPicker
        open
        mode="multiple"
        title="Sekundäre Muskelgruppen"
        selected={selected}
        onChange={setSelected}
        onClose={() => {}}
        excludeLabels={excludeLabels}
      />
      <output data-testid="selected">{selected.join(',')}</output>
    </>
  );
}

describe('MuscleGroupPicker — single', () => {
  it('selects exactly one and closes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SingleHarness onClose={onClose} />);

    await user.type(screen.getByLabelText(/^Suchen$/), 'Brust');
    await user.click(screen.getByRole('option', { name: /^Brust$/ }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('MuscleGroupPicker — multiple', () => {
  it('accumulates selections and toggles them off, without duplicates', async () => {
    const user = userEvent.setup();
    render(<MultiHarness />);

    await user.type(screen.getByLabelText(/^Suchen$/), 'Trizeps');
    await user.click(screen.getByRole('option', { name: /Trizeps/ }));
    await user.clear(screen.getByLabelText(/^Suchen$/));
    await user.type(screen.getByLabelText(/^Suchen$/), 'Bizeps');
    await user.click(screen.getByRole('option', { name: /^Bizeps$/ }));

    expect(screen.getByTestId('selected').textContent).toBe('Trizeps,Bizeps');

    // Toggling an already-selected entry removes it (no duplicate).
    await user.clear(screen.getByLabelText(/^Suchen$/));
    await user.type(screen.getByLabelText(/^Suchen$/), 'Trizeps');
    await user.click(screen.getByRole('option', { name: /Trizeps/ }));
    expect(screen.getByTestId('selected').textContent).toBe('Bizeps');
  });

  it('hides excluded labels (e.g. the primary group)', async () => {
    render(<MultiHarness excludeLabels={['Brust']} />);
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).queryByRole('option', { name: /^Brust$/ })).toBeNull();
  });
});

describe('MuscleGroupChips', () => {
  it('marks a custom (non-catalog) value and removes on click', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <MuscleGroupChips
        primary="Brust"
        secondary={['Mein eigener Muskel']}
        onRemoveSecondary={onRemove}
      />,
    );

    expect(screen.getByText(/\(eigen\)/)).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: /Mein eigener Muskel entfernen/ }),
    );
    expect(onRemove).toHaveBeenCalledWith('Mein eigener Muskel');
  });
});
