import { copyToClipboard, downloadJson } from '@/utils/download';

/**
 * Sharing an export through the operating system.
 *
 * Nothing is ever transmitted by the app itself: the Web Share API hands the
 * file to iOS, and the share sheet decides which apps are offered. Which app
 * appears there is entirely the operating system's business — the app cannot
 * and must not claim to open a particular one.
 *
 * Degrades in three steps, so the feature works everywhere:
 *   1. share the JSON as a file          (iOS Safari 15+, Android Chrome)
 *   2. share the content as text         (share supported, files are not)
 *   3. download it and copy to clipboard (no Web Share API at all)
 */

export type ShareOutcome =
  | 'shared-file'
  | 'shared-text'
  | 'downloaded'
  | 'cancelled'
  | 'failed';

export interface ShareResult {
  outcome: ShareOutcome;
  /** Whether the payload also landed on the clipboard. */
  copiedToClipboard: boolean;
  message: string;
}

type ShareNavigator = Navigator & {
  canShare?: (data: ShareData & { files?: File[] }) => boolean;
  share?: (data: ShareData & { files?: File[] }) => Promise<void>;
};

function shareNavigator(): ShareNavigator | null {
  return typeof navigator === 'undefined' ? null : (navigator as ShareNavigator);
}

export function canShareAtAll(): boolean {
  return typeof shareNavigator()?.share === 'function';
}

/** Whether this browser can put an actual .json file into the share sheet. */
export function canShareJsonFile(): boolean {
  const nav = shareNavigator();
  if (!nav?.share || typeof nav.canShare !== 'function' || typeof File === 'undefined') {
    return false;
  }
  try {
    const probe = new File(['{}'], 'probe.json', { type: 'application/json' });
    return nav.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** A cancelled share sheet is a normal user choice, not an error. */
function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/**
 * Offers `data` to the operating system, falling back to a download.
 *
 * Must be called directly from a user gesture — iOS rejects `navigator.share`
 * otherwise.
 */
export async function shareJsonExport(options: {
  fileName: string;
  data: unknown;
  title: string;
  /** Prepended when sharing as plain text, e.g. the analysis instruction. */
  textPrefix?: string;
  /** Above this size the JSON is not pushed through a text share. */
  maxTextLength?: number;
}): Promise<ShareResult> {
  const { fileName, data, title, textPrefix = '', maxTextLength = 60_000 } = options;
  const json = JSON.stringify(data, null, 2);
  const nav = shareNavigator();

  // 1. Share as a real file.
  if (canShareJsonFile() && nav?.share) {
    try {
      const file = new File([json], fileName, { type: 'application/json' });
      await nav.share({ files: [file], title });
      return {
        outcome: 'shared-file',
        copiedToClipboard: false,
        message: 'Datei wurde zum Teilen übergeben.',
      };
    } catch (error) {
      if (isAbort(error)) {
        return { outcome: 'cancelled', copiedToClipboard: false, message: 'Teilen abgebrochen.' };
      }
      // Fall through to the text path.
    }
  }

  // 2. Share as text, as long as it stays a sensible size.
  const text = textPrefix ? `${textPrefix}\n\n${json}` : json;
  if (nav?.share && text.length <= maxTextLength) {
    try {
      await nav.share({ title, text });
      return {
        outcome: 'shared-text',
        copiedToClipboard: false,
        message: 'Daten wurden als Text zum Teilen übergeben.',
      };
    } catch (error) {
      if (isAbort(error)) {
        return { outcome: 'cancelled', copiedToClipboard: false, message: 'Teilen abgebrochen.' };
      }
      // Fall through to the download path.
    }
  }

  // 3. Download, and offer the clipboard as a second route.
  try {
    downloadJson(fileName, data);
    const copied = text.length <= maxTextLength ? await copyToClipboard(text) : false;
    return {
      outcome: 'downloaded',
      copiedToClipboard: copied,
      message: copied
        ? 'Teilen wird hier nicht unterstützt. Die Datei wurde gespeichert und der Inhalt in die Zwischenablage kopiert.'
        : 'Teilen wird hier nicht unterstützt. Die Datei wurde gespeichert.',
    };
  } catch {
    return {
      outcome: 'failed',
      copiedToClipboard: false,
      message: 'Die Datei konnte nicht erzeugt werden.',
    };
  }
}
