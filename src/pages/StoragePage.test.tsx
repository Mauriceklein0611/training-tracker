import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { getSettings } from '@/db/repositories/settings';
import { setLanguage } from '@/i18n';
import { resetDatabase } from '@/tests/dbTestUtils';
import StoragePage from '@/pages/StoragePage';

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <StoragePage />
      </MemoryRouter>
    </ToastProvider>,
  );
}

beforeEach(async () => {
  await resetDatabase();
  await getSettings();
  setLanguage('de');
});

afterEach(() => setLanguage('de'));

describe('StoragePage localisation', () => {
  it('renders the storage screen in German', async () => {
    renderPage();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Lokale Speicherung' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Persistenter Speicher')).toBeInTheDocument();
    expect(screen.getByText('Datenbank')).toBeInTheDocument();
    expect(screen.getByText('Wichtig zu wissen')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Jeder Browser und jedes Gerät besitzt einen eigenen Datenbestand/,
      ),
    ).toBeInTheDocument();
  });

  it('renders the same screen in English without German leftovers', async () => {
    setLanguage('en');
    const { container } = renderPage();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Local storage' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Persistent storage')).toBeInTheDocument();
    expect(screen.getByText('Good to know')).toBeInTheDocument();
    expect(
      screen.getByText(/Every browser and every device has its own separate data/),
    ).toBeInTheDocument();

    // The database name is a technical identifier and stays as it is.
    expect(container.textContent).toContain('training-tracker');
    expect(container.textContent).not.toMatch(
      /Lokale Speicherung|Persistenter Speicher|Datenbank|Wichtig zu wissen|Sicherung/,
    );
  });

  it('shows the schema version and never translates it', async () => {
    renderPage();
    const german = (await screen.findByText(/Schemaversion:/)).parentElement?.textContent;
    setLanguage('en');
    expect(german).toMatch(/\d+/);
  });
});
