import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type * as BrandConfig from '@/config/brand';
import { setLanguage } from '@/i18n';
import { resetDatabase } from '@/tests/dbTestUtils';
import { readOnboardingState } from '@/services/onboarding';
import { OnboardingDialog } from '@/features/onboarding/OnboardingDialog';

vi.mock('@/config/brand', async (importOriginal) => {
  const actual = await importOriginal<typeof BrandConfig>();
  return {
    ...actual,
    appOrigin: () => 'canonical' as const,
    isLegacyMigrationAvailable: () => true,
  };
});

function renderDialog() {
  return render(
    <MemoryRouter>
      <OnboardingDialog />
    </MemoryRouter>,
  );
}

async function openMigrationStep() {
  const user = userEvent.setup();
  renderDialog();
  expect(await screen.findByRole('heading', { level: 2 })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /Weiter|Next/ }));
  await user.click(screen.getByRole('button', { name: /Weiter|Next/ }));
  await user.click(screen.getByRole('button', { name: /Weiter|Next/ }));
  return user;
}

beforeEach(async () => {
  localStorage.clear();
  await resetDatabase();
});

describe('OnboardingDialog migration entry', () => {
  it('opens the legacy app only by explicit choice and continues fresh on No', async () => {
    const user = await openMigrationStep();

    expect(
      screen.getByRole('heading', { name: 'Hast du die alte App schon benutzt?' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ja, alte App für Backup öffnen' }),
    ).toHaveAttribute('href', 'https://training-tracker-4xu.pages.dev/');
    expect(
      screen.getByRole('button', { name: 'Backup importieren' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Nein, neu starten' }));
    expect(screen.getByRole('heading', { name: 'Dein erster Plan' })).toBeInTheDocument();
  });

  it('renders the migration choice fully in English', async () => {
    setLanguage('en');
    await openMigrationStep();

    expect(
      screen.getByRole('heading', { name: 'Have you used the old app before?' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Yes, open the old app for backup' }),
    ).toHaveAttribute('href', 'https://training-tracker-4xu.pages.dev/');
    expect(screen.getByRole('button', { name: 'No, start fresh' })).toBeInTheDocument();
  });

  it('stores dismissal so the welcome dialog is not shown again', async () => {
    const user = userEvent.setup();
    const firstRender = renderDialog();
    expect(
      await screen.findByRole('heading', { name: 'Willkommen bei Exerivo' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Überspringen' }));
    expect(readOnboardingState()).toMatchObject({ completed: true });
    firstRender.unmount();

    renderDialog();
    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Willkommen bei Exerivo' }),
      ).not.toBeInTheDocument();
    });
  });
});
