import { printPdf } from '../../deliverables/printPdf';

/**
 * Printing labels and the full package. In the Windows desktop app the
 * Electron preload exposes `window.isaDesktop`; there the PDF goes straight
 * to the Windows print dialog / the chosen printer with the page size of
 * the PDF (label size for labels). In a browser the existing path is used
 * (browser print dialog, else the PDF is opened or saved).
 *
 * Contract for the desktop side (Electron preload, Debug 1):
 *   window.isaDesktop = {
 *     print(job: DesktopPrintJob): Promise<DesktopPrintResult>,
 *     listPrinters?(): Promise<DesktopPrinter[]>,
 *   }
 */

// The desktop bridge types live in src/desktop/bridge.ts (shared with the Electron preload).
import type { DesktopPrinter, IsaDesktop } from '../../desktop/bridge';
export type { DesktopPrintJob, DesktopPrintResult, DesktopPrinter, IsaDesktop } from '../../desktop/bridge';

/** The desktop bridge, when running inside the Windows app. */
export function desktop(): IsaDesktop | null {
  return typeof window !== 'undefined' && typeof window.isaDesktop?.print === 'function' ? window.isaDesktop : null;
}

/** Printers known to Windows (desktop app only). */
export async function desktopPrinters(): Promise<DesktopPrinter[]> {
  try {
    return (await desktop()?.listPrinters?.()) ?? [];
  } catch {
    return [];
  }
}

export type PrintOutcome = 'printed' | 'cancelled' | 'opened' | 'saved';

/**
 * Print a PDF: desktop app → Windows printing at actual size with the page
 * size of the PDF; browser → print dialog, new tab or saved file.
 */
export async function printLabelPdf(
  pdf: Blob,
  o: { fileName: string; jobName: string; pageWidthMm: number; pageHeightMm: number; uniformPageSize: boolean; printerName?: string },
): Promise<PrintOutcome> {
  const d = desktop();
  if (d) {
    const r = await d.print({
      pdf: new Uint8Array(await pdf.arrayBuffer()),
      jobName: o.jobName,
      pageWidthMm: o.pageWidthMm,
      pageHeightMm: o.pageHeightMm,
      uniformPageSize: o.uniformPageSize,
      printerName: o.printerName ?? '',
      showDialog: !o.printerName,
      scale: 'actual',
      copies: 1,
    });
    if (r.ok) return 'printed';
    if (r.cancelled) return 'cancelled';
    throw new Error(r.error || 'The printer did not accept the job.');
  }
  return printPdf(pdf, o.fileName);
}

/** Plain-English result of a print, for a status line. */
export function printMessage(r: PrintOutcome, what: string): string {
  switch (r) {
    case 'printed': return `${what} sent to the printer (or its print dialog). Print at 100 % (actual size), never "fit to page".`;
    case 'cancelled': return 'Printing was cancelled.';
    case 'opened': return `${what} opened in a new tab. Print it from there at 100 % (actual size).`;
    case 'saved': return `Printing is not available in this window, so the PDF was saved. Open it and print at 100 % (actual size).`;
  }
}
