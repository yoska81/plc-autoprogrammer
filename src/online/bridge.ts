/**
 * Modbus TCP access to a real PLC. The TCP socket lives in the desktop app
 * (Electron main process) and is exposed as `window.isaDesktop.modbus`; a
 * browser cannot open TCP connections, so in the web app and the preview the
 * Online page explains that it needs the desktop app.
 *
 * Contract (implemented for tests and as a reference by tools/modbus/client.cjs):
 * addresses are 0-based Modbus protocol addresses; requests run one at a time;
 * errors reject with a plain-English Error.
 */

export interface ModbusConnectOptions {
  host: string;
  /** Modbus TCP port, 502 by default. */
  port: number;
  unitId: number;
  timeoutMs: number;
}

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
  /** Socket closed / error; returns an unsubscribe function. */
  onStatus?(cb: (s: { connected: boolean; error?: string }) => void): () => void;
}

/** The desktop app's Modbus bridge, or null in a browser. */
export function modbusBridge(): ModbusBridge | null {
  if (typeof window === 'undefined') return null;
  const m = (window as unknown as { isaDesktop?: { modbus?: ModbusBridge } }).isaDesktop?.modbus;
  return m && typeof m.connect === 'function' ? m : null;
}
