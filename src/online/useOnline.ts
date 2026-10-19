import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { desktopBridge, type ModbusBridge } from '../desktop/bridge';
import { clickModbus, isWritable } from './clickModbus';
import { encodeWord, planReads, pollOnce, wordValueError, type ModbusRef, type ReadBlock } from './poll';

/**
 * Connection to a real CLICK PLC (desktop app only). Read-only by default:
 * writes need the "Allow writes" switch (never remembered) and a confirmation
 * in the UI, and are limited to C bits and DS registers — never X or Y.
 */

export type OnlineStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface OnlineSettings {
  host: string;
  port: number;
  unitId: number;
  timeoutMs: number;
  pollMs: number;
  /** 32-bit values high word first (not documented for CLICK; low word first by default). */
  swapWords: boolean;
}

interface OnlineStore {
  settings: OnlineSettings;
  setSettings: (s: Partial<OnlineSettings>) => void;
  status: OnlineStatus;
  error: string | null;
  bits: Map<string, boolean>;
  words: Map<string, number>;
  failed: Map<string, string>;
  lastUpdate: number | null;
  polls: number;
  /** Writes allowed for this connection only (resets on connect / reload). */
  allowWrites: boolean;
  setAllowWrites: (v: boolean) => void;
  /** Log of writes made, newest first. */
  writes: { at: string; address: string; value: string; ok: boolean; error?: string }[];
}

export const useOnlineStore = create<OnlineStore>()(
  persist(
    (set) => ({
      settings: { host: '192.168.0.10', port: 502, unitId: 1, timeoutMs: 2000, pollMs: 300, swapWords: false },
      setSettings: (s) => set((st) => ({ settings: { ...st.settings, ...s } })),
      status: 'disconnected',
      error: null,
      bits: new Map(),
      words: new Map(),
      failed: new Map(),
      lastUpdate: null,
      polls: 0,
      allowWrites: false,
      setAllowWrites: (allowWrites) => set({ allowWrites }),
      writes: [],
    }),
    { name: 'isa-online-settings', partialize: (s) => ({ settings: s.settings }) },
  ),
);

/** The desktop app's Modbus bridge (window.isaDesktop.modbus), or null in a browser. */
export function modbusBridge(): ModbusBridge | null {
  const m = desktopBridge()?.modbus;
  return m && typeof m.connect === 'function' ? m : null;
}

let session = 0;
let blocks: ReadBlock[] = [];

/** Modbus references of the addresses the project uses (unknown ones are reported back). */
export function refsFor(addresses: string[]): { refs: ModbusRef[]; unsupported: string[] } {
  const refs: ModbusRef[] = [];
  const unsupported: string[] = [];
  const seen = new Set<string>();
  for (const a of addresses) {
    const k = a.trim().toUpperCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    const r = clickModbus(k);
    if (r) refs.push(r); else unsupported.push(k);
  }
  return { refs, unsupported };
}

export async function connectPlc(addresses: string[], bridge: ModbusBridge | null = modbusBridge()): Promise<void> {
  const st = useOnlineStore.getState();
  if (!bridge) { useOnlineStore.setState({ status: 'error', error: 'Connecting to a PLC needs the ISA Auto Programmer desktop app.' }); return; }
  const my = ++session;
  useOnlineStore.setState({ status: 'connecting', error: null, allowWrites: false, bits: new Map(), words: new Map(), failed: new Map(), polls: 0, lastUpdate: null });
  const { host, port, unitId, timeoutMs } = st.settings;
  const r = await bridge.connect({ host: host.trim(), port, unitId, timeoutMs });
  if (my !== session) return;
  if (!r.ok) { useOnlineStore.setState({ status: 'error', error: `Could not connect to ${host}:${port}: ${r.error}` }); return; }
  blocks = planReads(refsFor(addresses).refs);
  useOnlineStore.setState({ status: 'connected' });
  // Poll until disconnected; one poll at a time.
  while (my === session) {
    const t0 = Date.now();
    try {
      const res = await pollOnce(bridge, blocks, useOnlineStore.getState().settings.swapWords);
      if (my !== session) break;
      useOnlineStore.setState((s) => ({ bits: res.bits, words: res.words, failed: res.failed, lastUpdate: Date.now(), polls: s.polls + 1, error: null }));
    } catch (e) {
      if (my !== session) break;
      const m = e instanceof Error ? e.message : String(e);
      // Between two polls the socket closed: say what that means at the machine.
      const why = /^Not connected$/.test(m) ? 'the PLC closed the connection (PLC switched off or restarted, cable unplugged, or its connection limit reached)' : m;
      useOnlineStore.setState({ status: 'error', error: `Connection lost: ${why}. Connect again.`, allowWrites: false });
      await bridge.disconnect().catch(() => {});
      session++;
      break;
    }
    await new Promise((res) => setTimeout(res, Math.max(50, useOnlineStore.getState().settings.pollMs - (Date.now() - t0))));
  }
}

export async function disconnectPlc(bridge: ModbusBridge | null = modbusBridge()): Promise<void> {
  session++;
  useOnlineStore.setState({ status: 'disconnected', allowWrites: false });
  await bridge?.disconnect().catch(() => {});
}

/**
 * Write one C bit or DS value. Refuses anything else, when writes are not allowed, and a value the register
 * cannot hold or that is outside the project's declared range for it (never sent clamped).
 */
export async function writePlc(address: string, value: boolean | number, bridge: ModbusBridge | null = modbusBridge(), declared?: { min: number | null; max: number | null }): Promise<void> {
  const st = useOnlineStore.getState();
  const r = clickModbus(address);
  const log = (ok: boolean, error?: string) => useOnlineStore.setState((s) => ({ writes: [{ at: new Date().toLocaleTimeString(), address: address.toUpperCase(), value: String(value), ok, error }, ...s.writes].slice(0, 50) }));
  if (!bridge || st.status !== 'connected') throw new Error('Not connected to a PLC.');
  if (!st.allowWrites) throw new Error('Writes are switched off. Turn on "Allow writes" first.');
  if (!r || !isWritable(address)) throw new Error(`${address} cannot be written from here: only C bits and DS registers are allowed (never X or Y).`);
  if (r.table !== 'coil') {
    const err = wordValueError(address.toUpperCase(), Number(value), r.type, declared);
    if (err) { log(false, err); throw new Error(err); }
  }
  try {
    if (r.table === 'coil') await bridge.writeCoil(r.register, Boolean(value));
    else await bridge.writeRegister(r.register, encodeWord(Number(value), r.type));
    log(true);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(false, msg);
    throw new Error(`Write to ${address} failed: ${msg}`, { cause: e });
  }
}
