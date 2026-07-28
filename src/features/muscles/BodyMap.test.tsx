import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { BodyMap } from '@/features/muscles/BodyMap';
import {
  BODY_REGIONS_BY_ID,
  MUSCLE_LABEL_TO_REGION,
  regionForMuscle,
} from '@/features/muscles/muscleRegions';
import { MUSCLE_GROUPS } from '@/constants/muscleGroups';

describe('muscle region mapping', () => {
  it('maps every catalog muscle label (except Ganzkörper) to a region', () => {
    const unmapped = MUSCLE_GROUPS.filter(
      (group) => group.label !== 'Ganzkörper' && !regionForMuscle(group.label),
    );
    expect(unmapped.map((group) => group.label)).toEqual([]);
  });

  it('points every mapping at a defined region id', () => {
    // Guard against a typo'd region id in the label→region table.
    for (const id of new Set(Object.values(MUSCLE_LABEL_TO_REGION))) {
      expect(BODY_REGIONS_BY_ID[id], `region "${id}" is defined`).toBeTruthy();
    }
  });
});

describe('BodyMap', () => {
  it('lists the primary and secondary muscles as a textual alternative', () => {
    render(<BodyMap primary={['Brust']} secondary={['Trizeps', 'Vordere Schulter']} />);
    const primaryRow = screen.getByText('Primär:').closest('div')!;
    expect(within(primaryRow).getByText('Brust')).toBeInTheDocument();
    expect(screen.getByText('Trizeps, Vordere Schulter')).toBeInTheDocument();
    // Both figures are labelled for screen readers.
    expect(screen.getByRole('img', { name: 'Vorderansicht' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Rückansicht' })).toBeInTheDocument();
  });

  it('has a legend so colour is never the only signal', () => {
    render(<BodyMap primary={['Quadrizeps']} />);
    expect(screen.getByText('Primär')).toBeInTheDocument();
    expect(screen.getByText('Sekundär')).toBeInTheDocument();
    expect(screen.getByText('Nicht beteiligt')).toBeInTheDocument();
  });

  it('keeps custom muscle labels in the text even without a region', () => {
    render(<BodyMap primary={['Eigenerfundener Muskel']} />);
    const primaryRow = screen.getByText('Primär:').closest('div')!;
    expect(within(primaryRow).getByText('Eigenerfundener Muskel')).toBeInTheDocument();
  });
});
