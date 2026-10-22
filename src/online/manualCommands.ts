import type { LadderProgram, Rung } from '../plc/core/ladder';
import type { HmiDesign } from '../hmi/types';
import type { RungPower } from '../plc/sim/engine';
import { clickModbus, isWritable } from './clickModbus';

/**
 * Manual commands on the Online page: the program's own HMI command bits (an HMI hold-to-run / momentary
 * button's C bit that the program reads), pressed from here while held. Only those bits are offered: a C bit
 * the program does not declare as an HMI command, an X input or a Y output is never written. CLICK cannot
 * force X / Y over the network; forcing is done in the CLICK programming software.
 */

export interface ManualCommand {
  /** C bit, e.g. "C1006". */
  address: string;
  /** What the operator calls it: the HMI button's label, else the tag's name. */
  label: string;
  /** The permissive bit the HMI button shows (pressed only while it reads ON). */
  interlock: string | null;
  /** What the program does with it (the rung comments that read it). */
  usedBy: string[];
}

const norm = (a: string) => a.trim().toUpperCase();

/** Bits the program reads: contacts, and timer / counter reset bits (where a command can have an effect). */
function contactsRead(program: LadderProgram): Map<string, Rung[]> {
  const m = new Map<string, Rung[]>();
  for (const r of program.rungs) {
    for (const br of r.branches) for (const el of br) {
      if (el.type === 'NO' || el.type === 'NC' || el.type === 'RISE' || el.type === 'FALL') {
        const k = norm(el.address);
        const list = m.get(k) ?? [];
        if (!list.includes(r)) list.push(r);
        m.set(k, list);
      }
    }
    // A timer's or counter's reset bit is read too ("Reset Count" on the panel).
    for (const o of r.outputs) if ((o.type === 'TMR' || o.type === 'CNT') && o.resetAddress) {
      const k = norm(o.resetAddress);
      const list = m.get(k) ?? [];
      if (!list.includes(r)) list.push(r);
      m.set(k, list);
    }
  }
  return m;
}

/**
 * The HMI command bits of the project: C bits an HMI momentary button writes (or HMI tags declared BIT and
 * written by the panel), that the program reads. Set / reset / toggle buttons (mode selectors) are not
 * hold-to-run commands and are left out.
 */
export function hmiCommands(program: LadderProgram, hmi: HmiDesign | null | undefined): ManualCommand[] {
  const read = contactsRead(program);
  const out = new Map<string, ManualCommand>();
  const add = (address: string | null | undefined, label: string, interlock: string | null) => {
    if (!address) return;
    const a = norm(address);
    if (!isWritable(a) || clickModbus(a)?.table !== 'coil' || !read.has(a)) return;
    const cur = out.get(a);
    if (cur) { if (!cur.interlock && interlock) cur.interlock = norm(interlock); return; }
    out.set(a, { address: a, label: label.trim() || a, interlock: interlock ? norm(interlock) : null, usedBy: read.get(a)!.map((r) => r.comment).filter(Boolean) });
  };
  for (const sc of hmi?.screens ?? []) {
    for (const e of sc.elements) if (e.kind === 'button' && (e.action === 'momentary' || e.action === null)) add(e.address, e.label, e.interlock ?? null);
  }
  for (const t of hmi?.tags ?? []) if (t.dataType === 'BIT' && t.access !== 'read' && !out.has(norm(t.address))) {
    // A tag written by the panel but drawn as a set / reset / toggle button is a mode selector, not a command.
    const latching = (hmi?.screens ?? []).some((sc) => sc.elements.some((e) => e.address && norm(e.address) === norm(t.address) && e.kind === 'button' && e.action !== 'momentary' && e.action !== null));
    if (!latching) add(t.address, t.name.replace(/_/g, ' ').replace(/^HMI\s+/i, ''), null);
  }
  return [...out.values()];
}

/**
 * Hold-to-run: ON while held, OFF on release. The writes go out one at a time in the order asked (a quick
 * press and release can never leave the bit ON because the OFF overtook the ON).
 */
export class HoldQueue {
  private chain: Promise<void> = Promise.resolve();
  readonly held = new Set<string>();
  private readonly write: (address: string, value: boolean) => Promise<void>;
  constructor(write: (address: string, value: boolean) => Promise<void>) { this.write = write; }

  press(address: string): Promise<void> {
    const a = norm(address);
    if (this.held.has(a)) return this.chain;
    this.held.add(a);
    return this.enqueue(a, true);
  }

  release(address: string): Promise<void> {
    const a = norm(address);
    if (!this.held.delete(a)) return this.chain;
    return this.enqueue(a, false);
  }

  /** Window lost focus, page closed, disconnect: every held command goes OFF. */
  releaseAll(): Promise<void> {
    for (const a of [...this.held]) void this.release(a);
    return this.chain;
  }

  private enqueue(address: string, value: boolean): Promise<void> {
    // A failed write never blocks the ones after it (the OFF after a failed ON still goes out). An ON refused
    // before anything was sent (writes off, not connected) is not followed by an OFF: that OFF could cancel the
    // same command held on the touch panel.
    this.chain = this.chain.then(async () => {
      if (value) { this.refused.delete(address); try { await this.write(address, true); } catch (e) { if (e instanceof RefusedError) this.refused.add(address); } return; }
      if (this.refused.delete(address)) return;
      await this.write(address, false).catch(() => {});
    });
    return this.chain;
  }
  private readonly refused = new Set<string>();
}

/** A command write refused before anything was sent to the PLC. */
export class RefusedError extends Error {}

/** One row of "Follow this rung": an element, what the PLC reads for it, and whether power reaches past it. */
export interface FollowRow {
  kind: 'contact' | 'compare' | 'output' | 'other';
  /** Branch number (1-based) for contacts; 0 for outputs. */
  branch: number;
  text: string;
  /** Address(es) read, for the name lookup. */
  addresses: string[];
  /** The value(s) as read: "ON" / "OFF" / a number, '—' when not read yet. */
  value: string;
  /** Contact closed / compare true / output commanded by the rung. */
  closed: boolean;
  /** Power reaches the right side of this element (contacts); the rung is true (outputs). */
  powered: boolean;
  /** Outputs: the bit as read back from the PLC differs from what this rung commands (another rung writes it, or SET / RST). */
  differs?: boolean;
}

const isConst = (a: string) => /^-?\d+(\.\d+)?$/.test(a.trim());

/** Rows for the selected rung from the live power flow and values. */
export function followRung(rung: Rung, p: RungPower | undefined, bits: Map<string, boolean>, words: Map<string, number>): FollowRow[] {
  const show = (a: string): string => {
    if (isConst(a)) return a.trim();
    const k = norm(a);
    if (bits.has(k)) return bits.get(k) ? 'ON' : 'OFF';
    if (words.has(k)) { const v = words.get(k)!; return Number.isInteger(v) ? String(v) : v.toFixed(3); }
    return '—';
  };
  const rows: FollowRow[] = [];
  rung.branches.forEach((br, b) => br.forEach((el, i) => {
    const closed = p?.closed[b]?.[i] ?? false, powered = p?.branches[b]?.[i] ?? false;
    if (el.type === 'CMP') rows.push({ kind: 'compare', branch: b + 1, text: `${el.left} ${el.op} ${el.right}`, addresses: [el.left, el.right].filter((a) => !isConst(a)), value: `${show(el.left)} ${el.op} ${show(el.right)}`, closed, powered });
    else if (el.type === 'RAW') rows.push({ kind: 'other', branch: b + 1, text: el.text, addresses: [], value: '—', closed: false, powered });
    else rows.push({ kind: 'contact', branch: b + 1, text: `${el.type === 'NO' ? 'NO' : el.type === 'NC' ? 'NC' : el.type === 'RISE' ? 'Rising edge' : 'Falling edge'} ${norm(el.address)}`, addresses: [norm(el.address)], value: show(el.address), closed, powered });
  }));
  const rungTrue = p?.rungTrue ?? false;
  for (const o of rung.outputs) {
    if (o.type === 'RAW') { rows.push({ kind: 'other', branch: 0, text: o.text, addresses: [], value: '—', closed: rungTrue, powered: rungTrue }); continue; }
    if (o.type === 'COPY') { rows.push({ kind: 'output', branch: 0, text: `Copy ${o.source} → ${o.dest}`, addresses: [o.dest], value: show(o.dest), closed: rungTrue, powered: rungTrue }); continue; }
    if (o.type === 'MATH') { rows.push({ kind: 'output', branch: 0, text: `${o.dest} = ${o.expression}`, addresses: [o.dest], value: show(o.dest), closed: rungTrue, powered: rungTrue }); continue; }
    const a = norm(o.address);
    const label = o.type === 'OUT' ? `Coil ${a}` : o.type === 'SET' ? `Set ${a}` : o.type === 'RST' ? `Reset ${a}` : o.type === 'TMR' ? `Timer ${a} (preset ${o.preset} ${o.unit})` : o.type === 'CNT' ? `Counter ${a} (preset ${o.preset})` : a;
    const v = show(a);
    // Only a plain coil must read what the rung commands; SET / RST hold, timers and counters have their own done bit.
    const differs = o.type === 'OUT' && v !== '—' && (v === 'ON') !== rungTrue;
    rows.push({ kind: 'output', branch: 0, text: label, addresses: [a], value: v, closed: rungTrue, powered: rungTrue, ...(differs ? { differs } : {}) });
  }
  return rows;
}

/**
 * The live values are stale when not connected, or when the last good read is older than a few poll periods
 * plus the timeout (the PLC stopped answering but the connection has not dropped yet).
 */
export function isStale(status: string, lastUpdate: number | null, now: number, pollMs: number, timeoutMs: number): boolean {
  if (status !== 'connected' || lastUpdate === null) return true;
  return now - lastUpdate > 3 * pollMs + timeoutMs;
}
