import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { getSettings } from '@/db/repositories/settings';
import { setLanguage } from '@/i18n';
import { resetDatabase } from '@/tests/dbTestUtils';
import HomePage from '@/pages/HomePage';

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <HomePage />
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

describe('HomePage localisation', () => {
  it('renders the empty start screen in German', async () => {
    renderPage();
    expect(
      await screen.findByRole('button', { name: /Freies Training starten/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cardio starten/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Überblick' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Noch keine Trainingsdaten')).toBeInTheDocument();
    });
  });

  it('renders the same screen in English without German leftovers', async () => {
    setLanguage('en');
    const { container } = renderPage();

    expect(
      await screen.findByRole('button', { name: /Start a free workout/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start cardio/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('No training data yet')).toBeInTheDocument();
    });
    // Scoped to the copy this page owns: the nested dialogs (StartFreeDialog,
    // PlanPackageTools) are migrated in a later stage of #31 and would still
    // report German here.
    expect(container.textContent).not.toMatch(
      /Überblick|Trainingspläne|Noch keine Trainingsdaten|Kein aktiver Trainingsplan|Letzte Einheit/,
    );
  });

  it('greets and dates the header in the active language', async () => {
    setLanguage('en');
    renderPage();
    // Greeting and day reference both come from the localised date helpers.
    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          level: 1,
          name: /Good (morning|afternoon|evening)/,
        }),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/Guten (Morgen|Tag|Abend)/)).not.toBeInTheDocument();
  });
});
