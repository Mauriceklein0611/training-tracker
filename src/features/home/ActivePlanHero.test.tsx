import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ActivePlanHero, type ActivePlanHeroData } from '@/features/home/ActivePlanHero';

function renderHero(data: ActivePlanHeroData, onStartNext = vi.fn(), disabled = false) {
  render(
    <MemoryRouter>
      <ActivePlanHero data={data} onStartNext={onStartNext} disabled={disabled} />
    </MemoryRouter>,
  );
  return onStartNext;
}

const base: ActivePlanHeroData = {
  planId: 'p1',
  planName: 'Muskelaufbau 3er-Split',
  dayNames: ['Push', 'Pull', 'Beine'],
  nextUnit: {
    templateId: 'd3',
    name: 'Beine',
    exerciseCount: 6,
    estimatedMinutes: 55,
    lastDoneDaysAgo: 6,
  },
  cycleWeek: { current: 4, total: 8 },
};

describe('ActivePlanHero', () => {
  it('shows the plan, cycle week and next unit, and starts it', async () => {
    const onStart = renderHero(base);
    expect(screen.getByText('Muskelaufbau 3er-Split')).toBeInTheDocument();
    expect(screen.getByText('Woche 4 / 8')).toBeInTheDocument();
    // "Beine" appears as the next-unit line and as its split chip.
    expect(screen.getAllByText('Beine').length).toBeGreaterThanOrEqual(1);

    // The "Als Nächstes" details: exercise count, estimate and last-done.
    expect(
      screen.getByText(/6 Übungen · ca\. 55 Min\. · zuletzt vor 6 Tagen/),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Training starten/ }));
    expect(onStart).toHaveBeenCalledWith('d3');
  });

  it('shows an active deload calmly with the remaining days', () => {
    renderHero({
      ...base,
      deload: {
        remainingDays: 5,
        endDate: '02.08.2026',
        intensityLabel: 'Mittel (−40 %)',
        percent: 0.4,
      },
    });
    expect(screen.getByText(/Deload aktiv · noch 5 Tage/)).toBeInTheDocument();
    expect(screen.getByText(/reduziert/)).toBeInTheDocument();
  });

  it('blocks starting while another session is active', () => {
    renderHero(base, vi.fn(), true);
    expect(screen.getByRole('button', { name: /Training starten/ })).toBeDisabled();
  });

  it('states plainly when there is no next unit', () => {
    renderHero({ ...base, nextUnit: undefined });
    expect(screen.getByText(/keine nächste Einheit geplant/)).toBeInTheDocument();
  });
});
