/**
 * Bridge between the app and the Windows desktop shell (Electron).
 * `electron/preload.cjs` puts `window.isaDesktop` in the page; in a browser it
 * is undefined and the app uses its web paths (download links, print dialog).
 */

export interface DesktopPrintJob {
  /** The PDF to print. */
  pdf: Uint8Array;
  /** Shown in the Windows print queue. */
  jobName: string;
  /** Page size of the PDF in mm (label size for label PDFs; the first page for mixed sizes). */
  pageWidthMm: number;
  pageHeightMm: number;
  /** True when every page has the same size (label PDFs): the printer's paper size should be set to it. */
  uniformPageSize: boolean;
  /** Windows printer name; empty = let the user choose in the print dialog. */
  printerName: string;
  /** Show the Windows print dialog (true) or print silently to `printerName` (false). */
  showDialog: boolean;
  /** Print at 100 % — never scale to fit (labels must come out at their real size). */
  scale: 'actual';
  copies: number;
}

export interface DesktopPrintResult {
  ok: boolean;
  /** Set when the user cancelled the dialog. */
  cancelled?: boolean;
  error?: string;
}

export interface DesktopPrinter {
  name: string;
  isDefault?: boolean;
}

export interface DesktopSaveResult {
  ok: boolean;
  /** Set when the user closed the Save dialog without saving. */
  cancelled?: boolean;
  /** Where the file was written. */
  path?: string;
  error?: string;
}

export interface IsaDesktop {
  /** Always true inside the desktop app. */
  isDesktop?: boolean;
  /** App version (package.json). */
  version?: string;
  print(job: DesktopPrintJob): Promise<DesktopPrintResult>;
  listPrinters?(): Promise<DesktopPrinter[]>;
  /** Native Save dialog, then write the file. */
  saveFile?(name: string, bytes: Uint8Array): Promise<DesktopSaveResult>;
}

declare global {
  interface Window { isaDesktop?: IsaDesktop }
}

/** The desktop bridge, when running inside the Windows app. */
export function desktopBridge(): IsaDesktop | null {
  return typeof window !== 'undefined' && window.isaDesktop ? window.isaDesktop : null;
}
