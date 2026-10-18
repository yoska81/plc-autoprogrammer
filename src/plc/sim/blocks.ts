/**
 * Machine blocks (stations / sections) for the simulator: which rungs and
 * devices belong to a block, and which signals a block reads from outside
 * itself (so they can be held at "healthy" values to test it alone).
 */
import type { LadderProgram, Rung } from '../core/ladder';
import { rungWrites } from '../core/ladder';
import { isBitAddress, isConstant, normAddress } from './engine';
import { deviceAddresses } from './machineModel';
import type { SimDevice } from './machineModel';

export const GENERAL_BLOCK = 'general';

export interface SimBlock {
  id: string;
  name: string;
  description: string;
  rungIds: string[];
}

/** Block id a rung belongs to; unknown or missing ids fall into "General". */
export function blockOfRung(program: LadderProgram, rung: Rung): string {
  const id = rung.block?.trim();
  return id && program.blocks?.some((b) => b.id === id) ? id : GENERAL_BLOCK;
}

/** Blocks in program order, only those that have rungs; "General" last. */
export function programBlocks(program: LadderProgram): SimBlock[] {
  const out = new Map<string, SimBlock>();
  for (const b of program.blocks ?? []) out.set(b.id, { id: b.id, name: b.name || b.id, description: b.description ?? '', rungIds: [] });
  const general: SimBlock = { id: GENERAL_BLOCK, name: 'General', description: 'Rungs without a block', rungIds: [] };
  for (const r of program.rungs) {
    const id = blockOfRung(program, r);
    (id === GENERAL_BLOCK ? general : out.get(id)!).rungIds.push(r.id);
  }
  const list = [...out.values()].filter((b) => b.rungIds.length);
  if (general.rungIds.length) list.push(general);
  return list;
}

type ReadKind = 'NO' | 'NC' | 'EDGE' | 'WORD';

const mathVars = (expr: string) => expr.toUpperCase().match(/[A-Z]+\d+/g)?.filter((a) => a !== 'MOD') ?? [];

/** Addresses a rung reads, with how the contacts use them. */
export function rungReads(rung: Rung): { address: string; how: ReadKind }[] {
  const out: { address: string; how: ReadKind }[] = [];
  const add = (a: string | null | undefined, how: ReadKind) => {
    if (!a || isConstant(a)) return;
    out.push({ address: normAddress(a), how: isBitAddress(a) ? how : 'WORD' });
  };
  for (const br of rung.branches) for (const el of br) {
    if (el.type === 'CMP') { add(el.left, 'WORD'); add(el.right, 'WORD'); }
    else if (el.type !== 'RAW') add(el.address, el.type === 'NO' ? 'NO' : el.type === 'NC' ? 'NC' : 'EDGE');
  }
  for (const o of rung.outputs) {
    switch (o.type) {
      case 'TMR': case 'CNT': add(o.preset, 'WORD'); add(o.resetAddress, 'NO'); break;
      case 'COPY': add(o.source, 'WORD'); break;
      case 'MATH': for (const v of mathVars(o.expression)) add(v, 'WORD'); break;
      default: break;
    }
  }
  return out;
}

/** Everything a rung touches (reads, writes, timer/counter values). */
export function rungAllAddresses(rung: Rung): string[] {
  const out = rungReads(rung).map((r) => r.address);
  for (const w of rungWrites(rung)) {
    const a = normAddress(w);
    out.push(a);
    if (/^T\d+$/.test(a)) out.push(`TD${a.slice(1)}`);
    if (/^CT\d+$/.test(a)) out.push(`CTD${a.slice(2)}`);
  }
  return out;
}

export function blockRungs(program: LadderProgram, blockId: string): Rung[] {
  return program.rungs.filter((r) => blockOfRung(program, r) === blockId);
}

export function blockAddresses(program: LadderProgram, blockId: string): Set<string> {
  return new Set(blockRungs(program, blockId).flatMap(rungAllAddresses));
}

/** Words written by a rung, incl. a timer's TD and a counter's CTD. */
function writesOf(rung: Rung): string[] {
  return rungAllAddresses(rung).filter((a) => rungWrites(rung).some((w) => normAddress(w) === a) || /^(TD|CTD)\d+$/.test(a));
}

export interface ExternalSignal {
  address: string;
  isWord: boolean;
  /** Suggested hold value ("healthy": the block's contacts on it pass). */
  value: boolean | number;
  /** Blocks whose rungs write it. */
  fromBlocks: string[];
}

const UNHEALTHY_RE = /\b(fault|faults|alarm|error|estop|e-stop|emergency|stop|stopped|trip|tripped|jam|jammed|timeout|fail|failed|abort)\b/i;

/**
 * Signals the block reads that only rungs in other blocks write. Field inputs
 * (X) are not included: their devices belong to the block and stay simulated.
 */
export function externalSignals(
  program: LadderProgram, blockId: string,
  labelOf: (a: string) => string = () => '', readWord: (a: string) => number = () => 0,
): ExternalSignal[] {
  const inside = blockRungs(program, blockId);
  const writtenInside = new Set(inside.flatMap(writesOf));
  const writers = new Map<string, Set<string>>();
  for (const r of program.rungs) {
    const b = blockOfRung(program, r);
    if (b === blockId) continue;
    for (const a of writesOf(r)) {
      if (!writers.has(a)) writers.set(a, new Set());
      writers.get(a)!.add(b);
    }
  }
  const uses = new Map<string, Set<ReadKind>>();
  for (const r of inside) for (const { address, how } of rungReads(r)) {
    if (address.startsWith('X') || address.startsWith('SC') || writtenInside.has(address) || !writers.has(address)) continue;
    if (!uses.has(address)) uses.set(address, new Set());
    uses.get(address)!.add(how);
  }
  return [...uses].map(([address, how]) => {
    const isWord = how.has('WORD');
    let value: boolean | number;
    if (isWord) value = readWord(address);
    else if (how.has('NO') && !how.has('NC')) value = true;
    else if (how.has('NC') && !how.has('NO')) value = false;
    else value = !UNHEALTHY_RE.test(`${labelOf(address)} ${address}`);
    return { address, isWord, value, fromBlocks: [...writers.get(address)!] };
  }).sort((a, b) => a.address.localeCompare(b.address, undefined, { numeric: true }));
}

/** Ids of the devices whose I/O the block's rungs use (conveyors follow their motor/sensors, an E-stop its safety relay). */
export function devicesInBlock(devices: SimDevice[], addresses: Set<string>): Set<string> {
  const ids = new Set<string>();
  for (const d of devices) {
    const { inputs, outputs } = deviceAddresses(d);
    if ([...inputs, ...outputs].some((a) => addresses.has(a))) ids.add(d.id);
  }
  for (const d of devices) {
    if (d.kind === 'conveyor' && (ids.has(d.motorId) || (d.pusherId && ids.has(d.pusherId)))) ids.add(d.id);
    if (d.kind === 'motor' && d.conveyorId && ids.has(d.conveyorId)) ids.add(d.id);
  }
  if (devices.some((d) => d.kind === 'safetyRelay' && ids.has(d.id))) {
    for (const d of devices) if (d.kind === 'estop' && !d.input) ids.add(d.id);
  }
  return ids;
}

/**
 * A change asked for one block keeps the rest of the program as it is: the proposal's rungs of that block
 * (and new rungs without a block) replace the block's rungs in place; every other rung stays the current one.
 * `outside` counts the proposal's changes to other blocks that were left out (added, changed or removed rungs).
 */
export function scopeToBlock(current: LadderProgram, proposed: LadderProgram, blockId: string): { program: LadderProgram; outside: number } {
  const curIds = new Set(current.rungs.map((r) => r.id));
  const inBlock = (p: LadderProgram, r: Rung) => blockOfRung(p, r) === blockId;
  const otherIds = new Set(current.rungs.filter((r) => !inBlock(current, r)).map((r) => r.id));
  const mine = proposed.rungs
    .filter((r) => !otherIds.has(r.id) && (inBlock(proposed, r) || (!curIds.has(r.id) && !r.block?.trim())))
    .map((r) => (blockId === GENERAL_BLOCK ? { ...r, block: undefined } : { ...r, block: blockId }));
  const same = (a: Rung, b: Rung) => JSON.stringify({ ...a, block: undefined }) === JSON.stringify({ ...b, block: undefined });
  const propById = new Map(proposed.rungs.map((r) => [r.id, r]));
  const mineIds = new Set(mine.map((r) => r.id));
  let outside = 0;
  for (const r of current.rungs) {
    if (inBlock(current, r)) continue;
    const p = propById.get(r.id);
    if (!p || !same(p, r)) outside++;
  }
  outside += proposed.rungs.filter((r) => !curIds.has(r.id) && !mineIds.has(r.id)).length;
  const rungs: Rung[] = [];
  let placed = false;
  for (const r of current.rungs) {
    if (!inBlock(current, r)) { rungs.push(r); continue; }
    if (!placed) { rungs.push(...mine); placed = true; }
  }
  if (!placed) rungs.push(...mine);
  const tags = [...current.tags];
  for (const t of proposed.tags) if (!tags.some((x) => normAddress(x.address) === normAddress(t.address))) tags.push(t);
  return { program: { ...current, rungs, tags }, outside };
}
