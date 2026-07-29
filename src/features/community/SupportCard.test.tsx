import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setLanguage } from '@/i18n';
import { KOFI_URL } from '@/config/externalLinks';
import { SupportCard } from '@/features/community/SupportCard';

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value });
}

beforeEach(() => {
  setLanguage('de');
  setOnline(true);
});

afterEach(() => {
  setOnline(true);
  setLanguage('de');
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'share');
});

describe('SupportCard', () => {
  it('offers support and sharing as equals in German', () => {
    render(<SupportCard />);
    expect(screen.getByText('Kostenlos. Privat. Unabhängig.')).toBeInTheDocument();
    const support = screen.getByRole('link', { name: /Projekt unterstützen/ });
    expect(support).toHaveAttribute('href', KOFI_URL);
    expect(support).toHaveAttribute('target', '_blank');
    expect(support).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('button', { name: /App teilen/ })).toBeInTheDocument();
    // No pressure: the free-forever note is always visible.
    expect(screen.getByText(/dauerhaft kostenlos/)).toBeInTheDocument();
  });

  it('localises to English', () => {
    setLanguage('en');
    render(<SupportCard />);
    expect(screen.getByText('Free. Private. Independent.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Support the project/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Share the app/ })).toBeInTheDocument();
  });

  it('never renders a dead support link', () => {
    render(<SupportCard kofiUrl="" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    // Sharing still works without a configured Ko-fi page.
    expect(screen.getByRole('button', { name: /App teilen/ })).toBeInTheDocument();
  });

  it('hides the external link offline and explains why, keeping sharing available', () => {
    setOnline(false);
    render(<SupportCard />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/Offline nicht verfügbar/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /App teilen/ })).toBeInTheDocument();
  });

  it('shares only a fixed text and the app origin — never app data', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });

    render(<SupportCard />);
    await userEvent.click(screen.getByRole('button', { name: /App teilen/ }));

    expect(share).toHaveBeenCalledTimes(1);
    const payload = share.mock.calls[0][0] as {
      title: string;
      text: string;
      url: string;
    };
    expect(payload.url).toBe(window.location.origin);
    expect(payload.url).not.toContain('?');
    // No workout, body or device data can leak into the payload.
    expect(`${payload.title} ${payload.text}`).not.toMatch(/kg|Satz|Sätze|IndexedDB/);
  });

  it('keeps both actions reachable by keyboard with 44px touch targets', async () => {
    const user = userEvent.setup();
    render(<SupportCard />);
    await user.tab();
    expect(screen.getByRole('link', { name: /Projekt unterstützen/ })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: /App teilen/ })).toHaveFocus();
    for (const element of [
      screen.getByRole('link', { name: /Projekt unterstützen/ }),
      screen.getByRole('button', { name: /App teilen/ }),
    ]) {
      expect(element.className).toMatch(/min-h-\[(4[4-9]|[5-9]\d)px\]/);
    }
  });
});
