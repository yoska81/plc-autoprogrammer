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

/** The DWG reader in use: the bundled GNU LibreDWG converter (builtIn), or another one chosen in Settings (configured). */
export interface DwgReaderStatus { configured: boolean; ok: boolean; builtIn?: boolean; path?: string; error?: string }

/** DWG import (electron/dwgReader.cjs): LibreDWG's dwg2dxf shipped with the installer, or another reader. */
export interface DwgReaderBridge {
  status(): Promise<DwgReaderStatus>;
  /** Advanced: choose another reader (a program or a .node module) in a native dialog. */
  configure(): Promise<DwgReaderStatus>;
  /** Back to the bundled converter. */
  clear(): Promise<DwgReaderStatus>;
  /** DWG in, DXF text out (same order), with the DWG version and warnings about what was not read. */
  read(files: { name: string; bytes: Uint8Array }[]): Promise<{ ok: true; files: { name: string; text: string; version?: string | null; warnings?: string[] }[] } | { ok: false; notConfigured?: boolean; error: string }>;
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
  /** Returns an unsubscribe (older app builds return nothing). */
  onOpenFile?(cb: (name: string, bytes: Uint8Array, filePath: string) => void): (() => void) | void;
  /** Closing the window waits for `flush` (the projects' last writes to IndexedDB), at most 10 s. */
  onFlushStorage?(flush: () => Promise<void>): void;
  /** Write again to a file chosen earlier in a Save dialog (or opened from Explorer). */
  writeFile?(filePath: string, bytes: Uint8Array): Promise<DesktopSaveResult>;
  /** Microphone permission for voice input: 'always' (remembered), 'session' (until the app closes) or 'ask'. */
  micPermission?: { get(): Promise<MicPermission>; reset(): Promise<MicPermission> };
  /** Connect to PLC over Modbus TCP (desktop app only: a browser can't open TCP sockets). */
  modbus?: ModbusBridge;
  /** DWG import (desktop app only; older builds don't have it). */
  dwg?: DwgReaderBridge;
  /** Send to TIA Portal through TIA Openness (Windows desktop app only; older builds don't have it). */
  tia?: TiaBridge;
  /** Send to CLICK: drives CLICK Programming Software while the user watches (Windows desktop app only). */
  click?: ClickBridge;
  codesys?: CodesysBridge;
}

/** The CLICK bridge (electron/clickBridge.cjs → tools/click-bridge/ClickBridge.exe): the same shape as TiaBridge. */
export interface ClickBridge {
  call(cmd: 'detect', args?: Record<string, never>): Promise<ClickDetect>;
  call(cmd: string, args?: Record<string, unknown>): Promise<unknown>;
  logPath(): Promise<string>;
  /** Shows the log file in Explorer (to send it to support). Older desktop apps lack it. */
  showLog?(): Promise<boolean>;
  onProgress(cb: (p: { id: number; text: string }) => void): () => void;
}

/** The CODESYS bridge (electron/codesysBridge.cjs → tools/codesys-bridge/CodesysBridge.exe): the same shape. */
export interface CodesysBridge {
  call(cmd: 'detect', args?: Record<string, never>): Promise<CodesysDetect>;
  call(cmd: string, args?: Record<string, unknown>): Promise<unknown>;
  logPath(): Promise<string>;
  showLog(): Promise<boolean>;
  /** The user's CODESYS project from Windows' Open dialog (null: cancelled). */
  pickProject(): Promise<string | null>;
  onProgress(cb: (p: { id: number; text: string }) => void): () => void;
}

/** CODESYS on this PC (tools/codesys-bridge/src/CodesysDetect.cs), newest first. */
export interface CodesysDetect {
  ready: boolean;
  installs: { name: string; version: string; exe: string; profile: string }[];
  /** Where the app's new CODESYS projects go (Documents\ISA Auto Programmer\CODESYS). */
  projectsDir: string;
  steps: string[];
}

/** CLICK Programming Software on this PC (tools/click-bridge/src/ClickDetect.cs), newest first. */
export interface ClickDetect {
  ready: boolean;
  installs: { name: string; version: string; exe: string }[];
  /** It is open now (the run uses the open one). */
  running: boolean;
  steps: string[];
}

/**
 * The TIA Portal bridge (electron/tiaBridge.cjs → tools/tia-bridge/TiaBridge.exe). `call` runs one bridge command
 * and resolves with its result; it rejects with the bridge's plain-English error. Progress lines of the running
 * command arrive through onProgress.
 */
export interface TiaBridge {
  call(cmd: 'detect', args?: Record<string, never>): Promise<TiaDetect>;
  call(cmd: string, args?: Record<string, unknown>): Promise<unknown>;
  /** Where the bridge's log is (to send it to support). */
  logPath(): Promise<string>;
  /** Returns an unsubscribe. */
  onProgress(cb: (p: { id: number; text: string }) => void): () => void;
}

/** What this PC has for TIA Openness (tools/tia-bridge/src/Detect.cs). */
export interface TiaDetect {
  /** TIA Openness is installed and the user may use it. */
  ready: boolean;
  /** TIA Portal versions installed ("V19"). */
  installed: string[];
  /** The Openness API of each version, newest first. */
  openness: { version: string; assemblyVersion: string; dll: string }[];
  inOpennessGroup: boolean;
  /** The Windows user ("PC1\\tech"). */
  user: string;
  /** What to do when something is missing, in order. */
  steps: string[];
}

export type MicPermission = 'always' | 'session' | 'ask';

declare global {
  interface Window { isaDesktop?: IsaDesktop }
}

/** The desktop bridge, when running inside the Windows app. */
export function desktopBridge(): IsaDesktop | null {
  return typeof window !== 'undefined' && window.isaDesktop ? window.isaDesktop : null;
}
