import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DurationField, NumberValueField } from '@/components/ui/Field';

/** Mirrors the plan editor: the parent stores the number, the field the text. */
function SetGoalHarness({ initial = 3 }: { initial?: number }) {
  const [value, setValue] = useState<number | undefined>(initial);
  return (
    <>
      <NumberValueField
        label="Sätze"
        required
        min={1}
        max={50}
        value={value}
        onValueChange={(next) => setValue(next ?? value)}
      />
      <output data-testid="stored">{value == null ? 'leer' : String(value)}</output>
    </>
  );
}

/**
 * A set goal has to be correctable. The old controlled field clamped every
 * keystroke, so deleting the "3" produced a "1" that could not be deleted
 * either — only 1x remained reachable.
 */
describe('NumberValueField', () => {
  it('lets the field be cleared and retyped instead of snapping to the minimum', () => {
    render(<SetGoalHarness />);
    const input = screen.getByLabelText('Sätze') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');
    // Clearing is not an edit: the plan keeps the value it had.
    expect(screen.getByTestId('stored')).toHaveTextContent('3');

    fireEvent.change(input, { target: { value: '5' } });
    expect(input.value).toBe('5');
    expect(screen.getByTestId('stored')).toHaveTextContent('5');
  });

  it('restores the previous value when a required field is left empty', () => {
    render(<SetGoalHarness />);
    const input = screen.getByLabelText('Sätze') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(input.value).toBe('3');
    expect(screen.getByTestId('stored')).toHaveTextContent('3');
  });

  it('does not report a value outside the range while typing, and clamps on blur', () => {
    render(<SetGoalHarness />);
    const input = screen.getByLabelText('Sätze') as HTMLInputElement;

    // The intermediate "0" of "05" must never reach the plan.
    fireEvent.change(input, { target: { value: '0' } });
    expect(screen.getByTestId('stored')).toHaveTextContent('3');
    fireEvent.change(input, { target: { value: '05' } });
    expect(screen.getByTestId('stored')).toHaveTextContent('5');

    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.blur(input);
    expect(input.value).toBe('50');
    expect(screen.getByTestId('stored')).toHaveTextContent('50');
  });

  it('reports undefined for an optional field that is emptied', () => {
    function Optional() {
      const [value, setValue] = useState<number | undefined>(12);
      return (
        <>
          <NumberValueField
            label="Wdh. von"
            min={0}
            value={value}
            onValueChange={setValue}
          />
          <output data-testid="stored">{value == null ? 'leer' : String(value)}</output>
        </>
      );
    }
    render(<Optional />);
    fireEvent.change(screen.getByLabelText('Wdh. von'), { target: { value: '' } });
    expect(screen.getByTestId('stored')).toHaveTextContent('leer');
  });
});

function DurationHarness({ initial }: { initial?: number }) {
  const [value, setValue] = useState<number | undefined>(initial);
  return (
    <>
      <DurationField label="Dauer" value={value} onValueChange={setValue} />
      <output data-testid="seconds">{value == null ? 'leer' : String(value)}</output>
    </>
  );
}

/**
 * A cardio duration is entered as 1 h 20 min 30 s, not as 4830 seconds —
 * and is still stored in seconds.
 */
describe('DurationField', () => {
  it('shows a stored duration split into hours, minutes and seconds', () => {
    render(<DurationHarness initial={4830} />);
    expect((screen.getByLabelText('Dauer – Stunden') as HTMLInputElement).value).toBe(
      '1',
    );
    expect((screen.getByLabelText('Dauer – Minuten') as HTMLInputElement).value).toBe(
      '20',
    );
    expect((screen.getByLabelText('Dauer – Sekunden') as HTMLInputElement).value).toBe(
      '30',
    );
  });

  it('reports the entered parts as whole seconds', () => {
    render(<DurationHarness />);
    fireEvent.change(screen.getByLabelText('Dauer – Stunden'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('Dauer – Minuten'), {
      target: { value: '20' },
    });
    fireEvent.change(screen.getByLabelText('Dauer – Sekunden'), {
      target: { value: '30' },
    });
    expect(screen.getByTestId('seconds')).toHaveTextContent('4830');
  });

  it('carries an entered 90 seconds over into 1 min 30 s on blur', () => {
    render(<DurationHarness />);
    const seconds = screen.getByLabelText('Dauer – Sekunden') as HTMLInputElement;
    fireEvent.change(seconds, { target: { value: '90' } });
    fireEvent.blur(seconds);
    expect((screen.getByLabelText('Dauer – Minuten') as HTMLInputElement).value).toBe(
      '1',
    );
    expect(seconds.value).toBe('30');
    expect(screen.getByTestId('seconds')).toHaveTextContent('90');
  });

  it('understands a typed clock value like 1:20:30', () => {
    render(<DurationHarness />);
    fireEvent.change(screen.getByLabelText('Dauer – Minuten'), {
      target: { value: '1:20:30' },
    });
    expect(screen.getByTestId('seconds')).toHaveTextContent('4830');
    expect((screen.getByLabelText('Dauer – Stunden') as HTMLInputElement).value).toBe(
      '1',
    );
  });

  it('reports undefined once every box is empty', () => {
    render(<DurationHarness initial={90} />);
    fireEvent.change(screen.getByLabelText('Dauer – Minuten'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Dauer – Sekunden'), {
      target: { value: '' },
    });
    expect(screen.getByTestId('seconds')).toHaveTextContent('leer');
  });
});
