import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setLanguage } from '@/i18n';
import { KOFI_URL, TALLY_FEEDBACK_URLS } from '@/config/externalLinks';
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

  it('drops the feedback entries for an invalid (non-https) URL', () => {
    render(<CommunityGroup tallyUrl="http://tally.so/r/plain" />);
    expect(
      screen.queryByRole('link', { name: /Feedback & Wünsche/ }),
    ).not.toBeInTheDocument();
    render(<CommunityGroup tallyUrl="not a url" />);
    expect(screen.queryByRole('link', { name: /Fehler melden/ })).not.toBeInTheDocument();
  });

  it('renders both feedback entries pointing at the same configured form', () => {
    render(<CommunityGroup tallyUrl={TALLY} />);
    const feedback = screen.getByRole('link', { name: /Feedback & Wünsche/ });
    const bug = screen.getByRole('link', { name: /Fehler melden/ });
    expect(feedback).toHaveAttribute('href', TALLY);
    expect(bug).toHaveAttribute('href', TALLY);
  });

  it('uses the German form when the app language is German', () => {
    render(<CommunityGroup />);
    expect(screen.getByRole('link', { name: /Feedback & Wünsche/ })).toHaveAttribute(
      'href',
      TALLY_FEEDBACK_URLS.de,
    );
    expect(screen.getByRole('link', { name: /Fehler melden/ })).toHaveAttribute(
      'href',
      TALLY_FEEDBACK_URLS.de,
    );
  });

  it('uses the English form when the app language is English', () => {
    setLanguage('en');
    render(<CommunityGroup />);
    expect(screen.getByRole('link', { name: /Feedback & requests/ })).toHaveAttribute(
      'href',
      TALLY_FEEDBACK_URLS.en,
    );
    expect(screen.getByRole('link', { name: /Report a bug/ })).toHaveAttribute(
      'href',
      TALLY_FEEDBACK_URLS.en,
    );
  });

  it('never appends query parameters carrying app data', () => {
    render(<CommunityGroup />);
    for (const link of screen.getAllByRole('link')) {
      const href = link.getAttribute('href') ?? '';
      expect(href).not.toContain('?');
      expect(href).not.toContain('#');
      expect(new URL(href).search).toBe('');
    }
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
    expect(screen.getAllByText(/Offline nicht verfügbar/).length).toBeGreaterThan(0);
    // Every entry, including feedback and bug report, stays listed.
    expect(screen.getByText(/Feedback & Wünsche/)).toBeInTheDocument();
    expect(screen.getByText(/Fehler melden/)).toBeInTheDocument();
  });

  it('exposes an accessible name announcing the external link, in a labelled group', () => {
    render(<CommunityGroup />);
    const group = screen.getByRole('region', { name: 'Community' });
    expect(group).toBeInTheDocument();
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('aria-label')).toMatch(
        /externer Link, öffnet in neuem Tab/,
      );
    }
    // The hint is visible for sighted users too.
    expect(
      screen.getByText(/öffnen einen externen Dienst in einem neuen Tab/),
    ).toBeInTheDocument();
  });

  it('reaches every entry by keyboard alone', async () => {
    const user = userEvent.setup();
    render(<CommunityGroup />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(3);
    for (const link of links) {
      await user.tab();
      expect(link).toHaveFocus();
    }
  });
});
