import { describe, expect, it } from 'vitest';
import { buildShareCardSvg, escapeXml } from '@/services/shareCard';

describe('escapeXml', () => {
  it('escapes the five XML special characters', () => {
    expect(escapeXml(`a & b < c > d " e ' f`)).toBe(
      'a &amp; b &lt; c &gt; d &quot; e &apos; f',
    );
  });
});

describe('buildShareCardSvg', () => {
  it('produces self-contained SVG with the title, stats and highlight', () => {
    const svg = buildShareCardSvg({
      title: 'Push abgeschlossen',
      subtitle: '28.07.2026',
      stats: [
        { label: 'Dauer', value: '54 min' },
        { label: 'Volumen', value: '8.430 kg' },
      ],
      highlight: 'Neuer Rekord: Bankdrücken',
    });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('Push abgeschlossen');
    expect(svg).toContain('8.430 kg');
    expect(svg).toContain('Neuer Rekord: Bankdrücken');
    // Self-contained: no external resources (the SVG namespace URI aside).
    expect(svg).not.toContain('<image');
    expect(svg).not.toMatch(/href\s*=/);
    expect(svg).not.toMatch(/url\(https?:/);
  });

  it('escapes user-supplied text and caps stats at four', () => {
    const svg = buildShareCardSvg({
      title: 'A & B',
      stats: [
        { label: '1', value: 'a' },
        { label: '2', value: 'b' },
        { label: '3', value: 'c' },
        { label: '4', value: 'd' },
        { label: '5', value: 'e' },
      ],
    });
    expect(svg).toContain('A &amp; B');
    // The fifth stat is dropped so the card never overflows.
    expect(svg).not.toContain('>5<');
  });
});
