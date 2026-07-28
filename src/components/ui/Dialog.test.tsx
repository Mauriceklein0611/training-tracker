import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Dialog } from '@/components/ui/Dialog';

/**
 * A4: dialogs must not share a static `dialog-title` id. Two dialogs rendered
 * together must each label themselves by their own heading, so a screen reader
 * never announces one dialog ("Training beenden?") with another's title.
 */
describe('Dialog accessible labelling', () => {
  it('gives each dialog a unique title id its aria-labelledby points at', () => {
    render(
      <>
        <Dialog open onClose={() => {}} title="Ausführung ändern">
          <p>eins</p>
        </Dialog>
        <Dialog open onClose={() => {}} title="Training beenden?">
          <p>zwei</p>
        </Dialog>
      </>,
    );

    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs).toHaveLength(2);

    const idA = dialogs[0].getAttribute('aria-labelledby');
    const idB = dialogs[1].getAttribute('aria-labelledby');
    expect(idA).toBeTruthy();
    expect(idB).toBeTruthy();
    expect(idA).not.toBe(idB);

    // aria-labelledby resolves to this dialog's own heading, not the other's.
    expect(document.getElementById(idA!)?.textContent).toBe('Ausführung ändern');
    expect(document.getElementById(idB!)?.textContent).toBe('Training beenden?');

    // Each dialog is reachable by its own accessible name.
    expect(screen.getByRole('dialog', { name: 'Training beenden?' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Ausführung ändern' })).toBeInTheDocument();
  });

  it('wires aria-describedby to the description only when one is given', () => {
    render(
      <Dialog open onClose={() => {}} title="Mit Text" description="Erklärung">
        <p>inhalt</p>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    const describedBy = dialog.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe('Erklärung');
  });
});
