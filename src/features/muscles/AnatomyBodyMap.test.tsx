import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AnatomyBodyMap } from '@/features/muscles/AnatomyBodyMap';

describe('AnatomyBodyMap', () => {
  it('renders the legend and a textual muscle list for screen readers', () => {
    render(<AnatomyBodyMap primary={['Brust']} secondary={['Trizeps']} />);
    expect(screen.getByText('Primär:')).toBeInTheDocument();
    expect(screen.getByText('Brust')).toBeInTheDocument();
    expect(screen.getByText('Sekundär:')).toBeInTheDocument();
    expect(screen.getByText('Trizeps')).toBeInTheDocument();
  });

  it('reports the slug of a tapped, mapped muscle', () => {
    const onSelectSlug = vi.fn();
    const { container } = render(
      <AnatomyBodyMap primary={['Brust']} onSelectSlug={onSelectSlug} />,
    );
    // The library sets id={slug} on each muscle path.
    const chest = container.querySelector('[id="chest"]');
    expect(chest).not.toBeNull();
    fireEvent.click(chest!);
    expect(onSelectSlug).toHaveBeenCalledWith('chest');
  });

  it('does not report decorative parts like the head', () => {
    const onSelectSlug = vi.fn();
    const { container } = render(
      <AnatomyBodyMap primary={['Brust']} onSelectSlug={onSelectSlug} />,
    );
    const head = container.querySelector('[id="head"]');
    if (head) {
      fireEvent.click(head);
      expect(onSelectSlug).not.toHaveBeenCalled();
    }
  });
});
