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

/** Modbus TCP connection settings ("Connect to PLC"). */
export interface ModbusConnectOptions {
  host: string;
  /** Modbus TCP port, 502 by default. */
  port: number;
  /** 1–247 (CLICK default 1); 0 is accepted. */
  unitId: number;
  /** Per request and for connecting, e.g. 2000. */
  timeoutMs: number;
}

/**
 * Modbus TCP to a real PLC (electron/modbus.cjs). Addresses are 0-based protocol
 * addresses; requests run one at a time; no retries; failures reject with a
 * plain-English Error ("Modbus exception 2 (illegal data address) at 16384",
 * "Timed out after 2000 ms", "Not connected"). At most 2000 bits / 125 registers per read.
 */
export interface ModbusBridge {
  connect(o: ModbusConnectOptions): Promise<{ ok: true } | { ok: false; error: string }>;
  disconnect(): Promise<void>;
  /** FC 01 */
  readCoils(address: number, count: number): Promise<boolean[]>;
  /** FC 02 */
  readDiscreteInputs(address: number, count: number): Promise<boolean[]>;
  /** FC 03 (raw uint16) */
  readHoldingRegisters(address: number, count: number): Promise<number[]>;
  /** FC 04 (raw uint16) */
  readInputRegisters(address: number, count: number): Promise<number[]>;
  /** FC 05 */
  writeCoil(address: number, value: boolean): Promise<void>;
  /** FC 06 (uint16) */
  writeRegister(address: number, value: number): Promise<void>;
  /** Socket opened / closed / error; returns an unsubscribe function. */
  onStatus?(cb: (s: { connected: boolean; error?: string }) => void): () => void;
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
  /** A project file (.isap) opened from Explorer (double-click / "Open with"). */
  onOpenFile?(cb: (name: string, bytes: Uint8Array, filePath: string) => void): void;
  /** Write again to a file chosen earlier in a Save dialog (or opened from Explorer). */
  writeFile?(filePath: string, bytes: Uint8Array): Promise<DesktopSaveResult>;
  /** Connect to PLC over Modbus TCP (desktop app only: a browser can't open TCP sockets). */
  modbus?: ModbusBridge;
}

declare global {
  interface Window { isaDesktop?: IsaDesktop }
}

/** The desktop bridge, when running inside the Windows app. */
export function desktopBridge(): IsaDesktop | null {
  return typeof window !== 'undefined' && window.isaDesktop ? window.isaDesktop : null;
}
