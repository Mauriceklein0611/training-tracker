import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { setLanguage } from '@/i18n';
import { KOFI_URL } from '@/config/externalLinks';
import { CommunityGroup } from '@/features/community/CommunityGroup';

const TALLY = 'https://tally.so/r/testform';

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value,
  });
}

beforeEach(() => {
  setLanguage('de');
  setOnline(true);
});

afterEach(() => {
  setOnline(true);
  setLanguage('de');
});

describe('CommunityGroup', () => {
  it('renders the Ko-fi support link safely in German', () => {
    render(<CommunityGroup />);
    const link = screen.getByRole('link', { name: /Projekt freiwillig unterstützen/ });
    expect(link).toHaveAttribute('href', KOFI_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    // No app data appended to the outbound URL.
    expect(link.getAttribute('href')).toBe(KOFI_URL);
  });

  it('localises the support label to English', () => {
    setLanguage('en');
    render(<CommunityGroup />);
    expect(screen.getByRole('link', { name: /Support the project/ })).toBeInTheDocument();
  });

  it('does not render feedback entries when Tally is not configured', () => {
    render(<CommunityGroup tallyUrl="" />);
    expect(
      screen.queryByRole('link', { name: /Feedback & Wünsche/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Fehler melden/ })).not.toBeInTheDocument();
  });

  it('renders both feedback entries pointing at the same configured form', () => {
    render(<CommunityGroup tallyUrl={TALLY} />);
    const feedback = screen.getByRole('link', { name: /Feedback & Wünsche/ });
    const bug = screen.getByRole('link', { name: /Fehler melden/ });
    expect(feedback).toHaveAttribute('href', TALLY);
    expect(bug).toHaveAttribute('href', TALLY);
  });

  it('renders nothing when no link is configured — never a dead link', () => {
    const { container } = render(<CommunityGroup kofiUrl="" tallyUrl="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('degrades to a non-interactive offline hint when offline', () => {
    setOnline(false);
    render(<CommunityGroup />);
    // No tappable link while offline …
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    // … but the entry and a clear hint stay visible.
    expect(screen.getByText(/Projekt freiwillig unterstützen/)).toBeInTheDocument();
    expect(screen.getByText(/Offline nicht verfügbar/)).toBeInTheDocument();
  });
});
