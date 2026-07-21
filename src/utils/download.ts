/**
 * File downloads, entirely client-side: a Blob URL is created, clicked and
 * revoked again. No data ever leaves the device.
 */
export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = 'application/json',
): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Give Safari a moment to start the download before releasing the URL.
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

export function downloadJson(filename: string, data: unknown): void {
  downloadTextFile(filename, JSON.stringify(data, null, 2), 'application/json');
}

export function downloadCsv(filename: string, csv: string): void {
  downloadTextFile(filename, csv, 'text/csv');
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Die Datei konnte nicht gelesen werden.'));
    reader.readAsText(file, 'utf-8');
  });
}

/**
 * Copies text to the clipboard, with a fallback for browsers that do not allow
 * the async Clipboard API (older iOS Safari, non-secure origins).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}
