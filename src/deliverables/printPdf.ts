import { IS_PREVIEW } from '../preview/mode';
import { saveBlob } from './files';

/**
 * Open a PDF in the browser's print dialog. Where printing is blocked (the
 * claude.ai preview window, pop-up blockers, browsers without a PDF viewer)
 * the PDF is saved instead so it can be printed from a PDF reader.
 * Returns 'printed' (dialog opened), 'opened' (PDF opened in a new tab) or 'saved'.
 */
export async function printPdf(pdf: Blob, fallbackName: string): Promise<'printed' | 'opened' | 'saved'> {
  if (IS_PREVIEW) {
    saveBlob(fallbackName, pdf);
    return 'saved';
  }
  const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
  try {
    await new Promise<void>((resolve, reject) => {
      const frame = document.createElement('iframe');
      frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;';
      const timer = setTimeout(() => reject(new Error('timeout')), 15000);
      frame.onload = () => {
        clearTimeout(timer);
        try {
          frame.contentWindow!.focus();
          frame.contentWindow!.print();
          resolve();
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
        // Keep the frame long enough for the print dialog to read it.
        setTimeout(() => frame.remove(), 60000);
      };
      frame.src = url;
      document.body.appendChild(frame);
    });
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return 'printed';
  } catch {
    // A new tab with the PDF viewer (its print button) — or the file when pop-ups are blocked.
    const w = window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    if (w) return 'opened';
    saveBlob(fallbackName, pdf);
    return 'saved';
  }
}
