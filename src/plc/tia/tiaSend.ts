/**
 * What "Send to TIA Portal" puts into the TIA Portal project (tools/tia-bridge commands plc, tags and blocks), from
 * the project: the CPU by its order number with the local signal modules in their slots, the PLC tags (the same
 * list as the .sdf tag table export: the program's tags and the wired I/O it does not use yet), and the program as
 * the LAD export's blocks (buildTiaLad) for the TIA Portal version that is open, in the order they import.
 */
import type { ProjectSnapshot } from '../../deliverables/collect';
import { exportContext } from '../../deliverables/exportContext';
import { buildScl, isS7300, TIA_AS, unusedIoTags } from '../core/profiles/siemens';
import { buildTiaLad, TIA_VERSIONS, type TiaLadExport, type TiaVersion } from '../core/profiles/siemensLad';

export interface TiaPlcRequest {
  orderNumber: string;
  /** The firmware TIA Portal must use (a CPU of another maker set up as a Siemens one: its manual's); none: the newest. */
  firmware?: string;
  name: string;
  /** Signal modules on the CPU's own rack, slot 2 onwards (S7-1200). */
  modules: { orderNumber: string; slot: number }[];
  /** What is left for the user to add in TIA Portal, in plain words. */
  notes: string[];
}

export interface TiaTagRow { name: string; dataType: string; logicalAddress: string; comment: string }

/** S7-1200 signal modules (SM 122x digital, SM 123x analog) go right of the CPU, slots 2–9. */
const SM_1200 = /^6ES72[23]\d-/;

export function tiaPlcRequest(p: ProjectSnapshot): TiaPlcRequest {
  const notes: string[] = [];
  // a Yaskawa SLIO CPU: the Siemens CPU TIA Portal sets it up as; its I/O modules come with Yaskawa's GSDML (by hand)
  const as = TIA_AS[p.cpu.id];
  if (as) return { orderNumber: as.orderNumber, firmware: as.firmware, name: 'PLC_1', modules: [], notes: [as.note, ...p.modules.map((m) => `${m}: on the SLIO System station (see above).`)] };
  const modules: TiaPlcRequest['modules'] = [];
  const rackOfCpu = p.cpu.platformId !== 'siemens-s7-1500';
  for (const part of p.modules) {
    if (rackOfCpu && SM_1200.test(part) && modules.length < 8) modules.push({ orderNumber: part, slot: modules.length + 2 });
    else notes.push(rackOfCpu ? `${part}: add it in TIA Portal (Device view) by hand.` : `${part}: ET 200SP I/O is added in TIA Portal by hand for now (Network view › ET 200SP).`);
  }
  return { orderNumber: p.cpu.id, name: 'PLC_1', modules, notes };
}

/** The PLC tags, as the tag table export writes them. */
export function tiaTagRows(p: ProjectSnapshot): TiaTagRow[] {
  const ctx = exportContext(p);
  const used = buildScl(p.ladder, ctx).tags;
  return [...used, ...unusedIoTags(p.ladder, ctx, used)].map((t) => ({ name: t.name, dataType: t.type, logicalAddress: t.address, comment: t.inferred ? `${t.comment} — check against Device configuration` : t.comment }));
}

/** The TIA Portal project's name for a project name (as its files are named). */
export const tiaProjectName = (projectName: string) => projectName.trim().replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'Machine';

/**
 * The block files' version for a TIA Portal version ("V19", "V19 Update 2", "19.0"): its own; a newer TIA Portal
 * than the export knows takes the newest (from V19 on a version imports its two previous versions' files too);
 * null for one older than the oldest.
 */
export function tiaBlockVersion(tiaVersion: string): TiaVersion | null {
  const n = Number(/(\d+)/.exec(tiaVersion)?.[1] ?? NaN);
  const known = TIA_VERSIONS.map((v) => Number(v.slice(1)));
  if (!Number.isFinite(n) || n < known[0]) return null;
  return `V${Math.min(n, known[known.length - 1])}` as TiaVersion;
}

export interface TiaBlockFile { name: string; kind: 'xml' | 'scl'; text: string }

export interface TiaBlocks {
  /** In the order TIA Portal takes them: the global DB, the SCL helpers (the LAD networks call them), the FCs, OB 1. */
  files: TiaBlockFile[];
  lad: number;
  viaScl: TiaLadExport['viaScl'];
  rungs: number;
  /** The rung (its number in the program, 1-based) a compile message's block and network is about; null: none. */
  rungOf(block: string | null, network: number | null): number | null;
}

export function tiaBlocks(p: ProjectSnapshot, version: TiaVersion): TiaBlocks {
  // S7-300 (a Yaskawa SLIO CPU): the program as one SCL source (TIA Portal generates FB "Machine", its DB and OB 1 from
  // it); the LAD blocks are written for S7-1200 / S7-1500
  if (isS7300(p.cpu)) {
    const scl = buildScl(p.ladder, exportContext(p)).scl.replace(/^\uFEFF/, '');
    return { files: [{ name: 'Machine.scl', kind: 'scl', text: scl }], lad: 0, viaScl: [], rungs: p.ladder.rungs.length, rungOf: () => null };
  }
  const x = buildTiaLad(p.ladder, exportContext(p), 'Machine', version);
  const rank = (name: string) => (/_DB\.xml$/.test(name) ? 0 : name.endsWith('.scl') ? 1 : name === 'Main.xml' ? 3 : 2);
  const files = x.files
    .map((f) => ({ name: f.name, kind: f.name.endsWith('.scl') ? 'scl' as const : 'xml' as const, text: f.content.replace(/^\uFEFF/, '') }))
    .sort((a, b) => rank(a.name) - rank(b.name));
  // an FC's networks are its rungs in program order (buildTiaLad), so network n of a block is its n-th rung
  const fcs = new Set(files.filter((f) => rank(f.name) === 2).map((f) => f.name.replace(/\.xml$/, '')));
  const byBlock = new Map<string, number[]>();
  const blockNames = [...fcs];
  const order = [...new Set(p.ladder.rungs.map((r) => r.block ?? ''))];
  order.forEach((b, i) => byBlock.set(blockNames[i], p.ladder.rungs.flatMap((r, k) => ((r.block ?? '') === b ? [k + 1] : []))));
  return {
    files, lad: x.lad, viaScl: x.viaScl, rungs: p.ladder.rungs.length,
    rungOf: (block, network) => (block && network ? byBlock.get(block)?.[network - 1] ?? null : null),
  };
}
