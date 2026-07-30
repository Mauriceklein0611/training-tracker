import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InfoHint } from '@/components/ui/InfoHint';
import { setLanguage } from '@/i18n';

afterEach(() => setLanguage('de'));

describe('InfoHint', () => {
  it('opens an accessible popover with the term explanation on tap', async () => {
    render(<InfoHint term="e1rm" />);

    // The trigger is reachable by touch/keyboard (a button, not a hover tooltip).
    const trigger = screen.getByRole('button', { name: 'Was bedeutet e1RM?' });
    await userEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'e1RM' });
    expect(dialog).toBeInTheDocument();
    // The estimate is explicitly framed as an estimate, never a measurement.
    expect(screen.getByText(/Nur eine Schätzung/)).toBeInTheDocument();
  });

  it('renders nothing for an unknown term', () => {
    const { container } = render(<InfoHint term="does-not-exist" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('localises the trigger and explanation in English', async () => {
    setLanguage('en');
    render(<InfoHint term="e1rm" />);

    await userEvent.click(screen.getByRole('button', { name: 'What does e1RM mean?' }));

    expect(screen.getByRole('dialog', { name: 'e1RM' })).toBeInTheDocument();
    expect(screen.getByText(/Only an estimate/)).toBeInTheDocument();
  });
});
