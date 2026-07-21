import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canShareJsonFile, canShareAtAll, shareJsonExport } from '@/services/share';
import * as download from '@/utils/download';

/**
 * The share fallback chain: file → text → download.
 * Every step has to work, because iOS, Android and desktop each land on a
 * different one.
 */

const ORIGINAL = {
  share: (navigator as { share?: unknown }).share,
  canShare: (navigator as { canShare?: unknown }).canShare,
};

function setNavigator(overrides: { share?: unknown; canShare?: unknown }) {
  Object.assign(navigator, { share: undefined, canShare: undefined, ...overrides });
}

beforeEach(() => {
  vi.spyOn(download, 'downloadJson').mockImplementation(() => undefined);
  vi.spyOn(download, 'copyToClipboard').mockResolvedValue(true);
});

afterEach(() => {
  Object.assign(navigator, ORIGINAL);
  vi.restoreAllMocks();
});

const payload = { fileName: 'training-ai-export-2026-07-21.json', data: { a: 1 }, title: 'T' };

describe('capability detection', () => {
  it('reports no sharing when the API is absent', () => {
    setNavigator({});
    expect(canShareAtAll()).toBe(false);
    expect(canShareJsonFile()).toBe(false);
  });

  it('reports text-only sharing when canShare is missing', () => {
    setNavigator({ share: vi.fn() });
    expect(canShareAtAll()).toBe(true);
    expect(canShareJsonFile()).toBe(false);
  });

  it('reports file sharing when canShare accepts a json file', () => {
    setNavigator({ share: vi.fn(), canShare: () => true });
    expect(canShareJsonFile()).toBe(true);
  });

  it('reports no file sharing when canShare rejects files', () => {
    setNavigator({ share: vi.fn(), canShare: () => false });
    expect(canShareJsonFile()).toBe(false);
  });
});

describe('shareJsonExport', () => {
  it('shares a correctly named json file when supported', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator({ share, canShare: () => true });

    const result = await shareJsonExport(payload);

    expect(result.outcome).toBe('shared-file');
    const shared = share.mock.calls[0][0] as { files: File[] };
    expect(shared.files[0].name).toBe('training-ai-export-2026-07-21.json');
    expect(shared.files[0].type).toBe('application/json');
    expect(download.downloadJson).not.toHaveBeenCalled();
  });

  it('falls back to text when files are not supported', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator({ share, canShare: () => false });

    const result = await shareJsonExport({ ...payload, textPrefix: 'Analysiere bitte.' });

    expect(result.outcome).toBe('shared-text');
    const shared = share.mock.calls[0][0] as { text: string };
    expect(shared.text).toContain('Analysiere bitte.');
    expect(shared.text).toContain('"a": 1');
  });

  it('falls back to a download when sharing is unavailable', async () => {
    setNavigator({});

    const result = await shareJsonExport(payload);

    expect(result.outcome).toBe('downloaded');
    expect(result.copiedToClipboard).toBe(true);
    expect(download.downloadJson).toHaveBeenCalledWith(payload.fileName, payload.data);
  });

  it('still reports success when the clipboard is refused', async () => {
    setNavigator({});
    vi.spyOn(download, 'copyToClipboard').mockResolvedValue(false);

    const result = await shareJsonExport(payload);

    expect(result.outcome).toBe('downloaded');
    expect(result.copiedToClipboard).toBe(false);
    expect(result.message).not.toContain('Zwischenablage');
  });

  it('treats a dismissed share sheet as cancelled, not as an error', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    setNavigator({ share: vi.fn().mockRejectedValue(abort), canShare: () => true });

    const result = await shareJsonExport(payload);

    expect(result.outcome).toBe('cancelled');
    // Nothing downloaded behind the user's back after they said no.
    expect(download.downloadJson).not.toHaveBeenCalled();
  });

  it('falls through to text when the file share fails for another reason', async () => {
    const share = vi
      .fn()
      .mockRejectedValueOnce(new Error('not permitted'))
      .mockResolvedValueOnce(undefined);
    setNavigator({ share, canShare: () => true });

    const result = await shareJsonExport(payload);

    expect(result.outcome).toBe('shared-text');
    expect(share).toHaveBeenCalledTimes(2);
  });

  it('downloads instead of sharing an oversized text payload', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator({ share, canShare: () => false });

    const result = await shareJsonExport({
      ...payload,
      data: { big: 'x'.repeat(5000) },
      maxTextLength: 100,
    });

    expect(result.outcome).toBe('downloaded');
    expect(share).not.toHaveBeenCalled();
  });
});
