import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setLanguage } from '@/i18n';
import { TALLY_FEEDBACK_URLS } from '@/config/externalLinks';
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
  it('renders the feedback link safely in German', () => {
    render(<CommunityGroup tallyUrl={TALLY} />);
    const link = screen.getByRole('link', { name: /Feedback geben/ });
    expect(link).toHaveAttribute('href', TALLY);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders nothing when Tally is not configured — never a dead link', () => {
    const { container } = render(<CommunityGroup tallyUrl="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for an invalid (non-https) URL', () => {
    expect(
      render(<CommunityGroup tallyUrl="http://tally.so/r/plain" />).container,
    ).toBeEmptyDOMElement();
    expect(
      render(<CommunityGroup tallyUrl="not a url" />).container,
    ).toBeEmptyDOMElement();
  });

  it('offers exactly one Tally entry covering bugs, ideas and feedback (#33)', () => {
    render(<CommunityGroup tallyUrl={TALLY} />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    // The duplicate bug-report entry is gone; the category is picked in Tally.
    expect(screen.queryByRole('link', { name: /Fehler melden/ })).not.toBeInTheDocument();
    expect(
      screen.getByText('Fehler melden, Idee teilen oder Verbesserung vorschlagen.'),
    ).toBeInTheDocument();
  });

  it('uses the German form when the app language is German', () => {
    render(<CommunityGroup />);
    expect(screen.getByRole('link', { name: /Feedback geben/ })).toHaveAttribute(
      'href',
      TALLY_FEEDBACK_URLS.de,
    );
  });

  it('uses the English form and English copy when the app language is English', () => {
    setLanguage('en');
    render(<CommunityGroup />);
    expect(screen.getByRole('link', { name: /Send feedback/ })).toHaveAttribute(
      'href',
      TALLY_FEEDBACK_URLS.en,
    );
    expect(
      screen.getByText('Report a bug, share an idea, or suggest an improvement.'),
    ).toBeInTheDocument();
  });

  it('shows no leftover strings of the other language', () => {
    const { container, unmount } = render(<CommunityGroup />);
    expect(container.textContent).not.toMatch(/Send feedback|external service/);
    unmount();
    setLanguage('en');
    const english = render(<CommunityGroup />);
    expect(english.container.textContent).not.toMatch(/Feedback geben|externen Dienst/);
  });

  it('never appends query parameters carrying app data', () => {
    render(<CommunityGroup />);
    const href = screen.getByRole('link').getAttribute('href') ?? '';
    expect(href).not.toContain('?');
    expect(href).not.toContain('#');
    expect(new URL(href).search).toBe('');
  });

  it('degrades to a non-interactive offline hint when offline', () => {
    setOnline(false);
    render(<CommunityGroup />);
    // No tappable link while offline …
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    // … but the entry and a clear hint stay visible.
    expect(screen.getByText(/Feedback geben/)).toBeInTheDocument();
    expect(screen.getByText(/Offline nicht verfügbar/)).toBeInTheDocument();
  });

  it('exposes an accessible name announcing the external link, in a labelled group', () => {
    render(<CommunityGroup />);
    expect(screen.getByRole('region', { name: 'Community' })).toBeInTheDocument();
    expect(screen.getByRole('link').getAttribute('aria-label')).toMatch(
      /externer Link, öffnet in neuem Tab/,
    );
    // The hint is visible for sighted users too.
    expect(
      screen.getByText(/öffnen einen externen Dienst in einem neuen Tab/),
    ).toBeInTheDocument();
  });

  it('reaches the entry by keyboard alone', async () => {
    const user = userEvent.setup();
    render(<CommunityGroup />);
    await user.tab();
    expect(screen.getByRole('link')).toHaveFocus();
  });
});
