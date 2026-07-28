import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EffortField } from '@/features/session/EffortField';

describe('EffortField', () => {
  it('records RIR and shows the approximate RPE, storing only RIR', async () => {
    const onChange = vi.fn();
    render(<EffortField mode="rir" rir="" rpe="" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: '2' }));
    // Only RIR is stored; RPE stays empty (never a second measurement).
    expect(onChange).toHaveBeenCalledWith({ rir: '2', rpe: '' });
  });

  it('shows the RPE→RIR approximation for a selected RPE and stores only RPE', async () => {
    const onChange = vi.fn();
    render(<EffortField mode="rpe" rir="" rpe="8" onChange={onChange} />);

    // RPE 8 ≈ 2 RIR, clearly marked as an approximation.
    expect(screen.getByText(/≈ 2 RIR · Näherung/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '9' }));
    expect(onChange).toHaveBeenCalledWith({ rpe: '9', rir: '' });
  });

  it('clears the value when the active chip is tapped again', async () => {
    const onChange = vi.fn();
    render(<EffortField mode="rir" rir="2" rpe="" onChange={onChange} />);

    const chip = screen.getByRole('button', { name: '2' });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(chip);
    expect(onChange).toHaveBeenCalledWith({ rir: '', rpe: '' });
  });

  it('treats the last RIR chip as "4 or more"', () => {
    render(<EffortField mode="rir" rir="6" rpe="" onChange={() => {}} />);
    // A stored RIR of 6 still marks the "4+" chip as active.
    expect(screen.getByRole('button', { name: '4+' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
