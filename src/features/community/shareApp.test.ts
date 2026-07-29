import { afterEach, describe, expect, it, vi } from 'vitest';
import { appShareUrl, shareApp } from '@/features/community/shareApp';

const PAYLOAD = { title: 'Training Tracker', text: 'A private training log.' };

function stub(name: 'share' | 'clipboard', value: unknown) {
  Object.defineProperty(navigator, name, { configurable: true, value });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'share');
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('shareApp', () => {
  it('shares the bare app origin, never a path, query or app data', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    stub('share', share);

    expect(await shareApp(PAYLOAD)).toBe('shared');
    expect(share).toHaveBeenCalledWith({ ...PAYLOAD, url: window.location.origin });
    expect(appShareUrl()).toBe(window.location.origin);
    expect(appShareUrl()).not.toMatch(/[?#]/);
  });

  it('reports a cancelled share sheet as cancelled, not as an error', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    stub('share', vi.fn().mockRejectedValue(abort));
    expect(await shareApp(PAYLOAD)).toBe('cancelled');
  });

  it('falls back to the clipboard when the Share API is missing', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stub('clipboard', { writeText });

    expect(await shareApp(PAYLOAD)).toBe('copied');
    expect(writeText).toHaveBeenCalledWith(window.location.origin);
  });

  it('falls back to the clipboard when sharing fails for another reason', async () => {
    stub('share', vi.fn().mockRejectedValue(new Error('not allowed')));
    const writeText = vi.fn().mockResolvedValue(undefined);
    stub('clipboard', { writeText });

    expect(await shareApp(PAYLOAD)).toBe('copied');
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it('reports unavailable when neither path works, without throwing', async () => {
    stub('clipboard', { writeText: vi.fn().mockRejectedValue(new Error('blocked')) });
    expect(await shareApp(PAYLOAD)).toBe('unavailable');
  });
});
