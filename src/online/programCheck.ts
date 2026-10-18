/**
 * Online checks for a CLICK PLC over Modbus TCP:
 * - testConnection: does the PLC answer on Modbus TCP, is it in RUN, does it report an error. CLICK system
 *   bits (help 109): SC10 _Mode_Switch (switch in RUN), SC11 _PLC_Mode (PLC in RUN), SC19 _PLC_Error. The CPU
 *   model is not readable over Modbus (no documented register), so it is compared by eye with the label.
 * - programCheck: after the program has been typed into CLICK Programming Software and written to the PLC,
 *   every address of the project (the nickname list) must be readable on this CPU, and the setpoints the
 *   program loads on its first scan must hold an in-range value (a fresh PLC holds 0: a register still out of
 *   range means that part of the program is not running).
 */
import type { ModbusBridge } from '../desktop/bridge';
import type { LadderProgram } from '../plc/core/ladder';
import { clickModbus } from './clickModbus';
import { decodeWord, type ModbusRef } from './poll';

export interface CheckLine { ok: boolean | null; text: string }

const SC = (n: number) => clickModbus(`SC${n}`)!.register;

/**
 * Connect (unless already connected), read the CLICK run / error bits and report in plain words. Leaves the
 * connection as it found it.
 */
export async function testConnection(bridge: ModbusBridge | null, o: { host: string; port: number; unitId: number; timeoutMs: number }, alreadyConnected: boolean, expectCpu: string): Promise<CheckLine[]> {
  if (!bridge) return [{ ok: false, text: 'Testing the connection needs the ISA Auto Programmer desktop app (a web browser cannot open a connection to the PLC).' }];
  const lines: CheckLine[] = [];
  if (!alreadyConnected) {
    const r = await bridge.connect({ host: o.host.trim(), port: o.port, unitId: o.unitId, timeoutMs: o.timeoutMs });
    if (!r.ok) return [{ ok: false, text: r.error }];
  }
  lines.push({ ok: true, text: `The PLC answers at ${o.host.trim()}:${o.port} (Modbus TCP, unit ${o.unitId}).` });
  try {
    const sc = await bridge.readDiscreteInputs(SC(10), 10); // SC10 … SC19
    const [sw, run, err] = [sc[0], sc[1], sc[9]];
    lines.push(run
      ? { ok: true, text: 'The PLC is in RUN (SC11 _PLC_Mode ON).' }
      : { ok: false, text: `The PLC is in STOP (SC11 _PLC_Mode OFF): the program does not run and the outputs stay OFF.${sw ? '' : ' Its mode switch is in STOP (SC10 OFF): put it in RUN.'}` });
    if (run && !sw) lines.push({ ok: null, text: 'The mode switch reads STOP (SC10 OFF) although the PLC runs: check the switch.' });
    lines.push(err ? { ok: false, text: 'The PLC reports an error (SC19 _PLC_Error ON): look at the ERR LED, and at the error in CLICK Programming Software (connected).' } : { ok: true, text: 'No PLC error (SC19 OFF).' });
  } catch (e) {
    lines.push({ ok: false, text: `It answers, but not with the CLICK system bits (${e instanceof Error ? e.message : String(e)}): is this a CLICK PLC, and the right IP address?` });
  }
  lines.push({ ok: null, text: `The CPU model cannot be read over Modbus: check that the label on the CPU says ${expectCpu}.` });
  if (!alreadyConnected) await bridge.disconnect().catch(() => {});
  return lines;
}

/** Setpoints the program loads on its first scan when out of range (rungs "SC2 and A < min / SC2 and A > max → copy default to A"). */
export function firstScanRanges(program: LadderProgram): { address: string; min: number | null; max: number | null }[] {
  const out = new Map<string, { address: string; min: number | null; max: number | null }>();
  for (const r of program.rungs) {
    if (!r.branches.some((b) => b.some((e) => e.type === 'NO' && e.address.toUpperCase() === 'SC2'))) continue;
    for (const o of r.outputs) {
      if (o.type !== 'COPY' || !/^(DS|DD|DF)\d+$/i.test(o.dest)) continue;
      const a = o.dest.toUpperCase();
      const x = out.get(a) ?? { address: a, min: null, max: null };
      for (const e of r.branches.flat()) {
        if (e.type !== 'CMP' || e.left.toUpperCase() !== a || !/^-?\d+(\.\d+)?$/.test(e.right)) continue;
        if (e.op === '<') x.min = Number(e.right);
        if (e.op === '>') x.max = Number(e.right);
      }
      if (x.min !== null || x.max !== null) out.set(a, x);
    }
  }
  return [...out.values()];
}

async function readOne(bridge: ModbusBridge, r: ModbusRef, swapWords: boolean): Promise<boolean | number> {
  if (r.table === 'coil') return (await bridge.readCoils(r.register, 1))[0];
  if (r.table === 'discrete') return (await bridge.readDiscreteInputs(r.register, 1))[0];
  const v = r.table === 'holding' ? await bridge.readHoldingRegisters(r.register, r.words) : await bridge.readInputRegisters(r.register, r.words);
  return decodeWord(v, r.type, swapWords);
}

export interface ProgramCheckResult {
  lines: CheckLine[];
  /** Addresses with no Modbus address (not checkable) or refused by the PLC (not on this CPU). */
  missing: string[];
  refused: { address: string; error: string }[];
  /** First-scan setpoints still out of range. */
  outOfRange: { address: string; value: number; min: number | null; max: number | null }[];
  read: number;
}

/** Read every project address once (one at a time, so a refused address points at itself) and the first-scan setpoints. */
export async function programCheck(bridge: ModbusBridge, addresses: string[], program: LadderProgram, swapWords = false): Promise<ProgramCheckResult> {
  const res: ProgramCheckResult = { lines: [], missing: [], refused: [], outOfRange: [], read: 0 };
  const values = new Map<string, boolean | number>();
  for (const a of [...new Set(addresses.map((x) => x.trim().toUpperCase()).filter(Boolean))]) {
    const r = clickModbus(a);
    if (!r) { res.missing.push(a); continue; }
    try { values.set(a, await readOne(bridge, r, swapWords)); res.read++; } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/not connected|closed|timed out/i.test(msg)) throw e;
      res.refused.push({ address: a, error: msg });
    }
  }
  for (const f of firstScanRanges(program)) {
    let v = values.get(f.address);
    if (v === undefined) { const r = clickModbus(f.address); if (r) { try { v = await readOne(bridge, r, swapWords); } catch { /* reported above */ } } }
    if (typeof v !== 'number') continue;
    if ((f.min !== null && v < f.min) || (f.max !== null && v > f.max)) res.outOfRange.push({ address: f.address, value: v, min: f.min, max: f.max });
  }
  res.lines.push({ ok: res.refused.length === 0, text: `${res.read} of ${res.read + res.refused.length} addresses read${res.refused.length ? `; the PLC refused ${res.refused.map((x) => x.address).join(', ')} (not on this CPU / module configuration?)` : ''}.` });
  if (res.missing.length) res.lines.push({ ok: null, text: `No Modbus address for ${res.missing.join(', ')} (not checked).` });
  const ranges = firstScanRanges(program).length;
  if (ranges) res.lines.push(res.outOfRange.length
    ? { ok: false, text: `${res.outOfRange.length} of ${ranges} setpoints the program loads on its first scan are still out of range (${res.outOfRange.map((x) => `${x.address} = ${x.value}`).join(', ')}): those rungs are not in the PLC yet, or the PLC has not been in RUN since.` }
    : { ok: true, text: `All ${ranges} setpoints the program loads on its first scan hold in-range values: the program has run.` });
  return res;
}
